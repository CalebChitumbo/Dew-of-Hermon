import 'package:flutter_test/flutter_test.dart';

import 'package:dew_of_hermon/core/access/access_control.dart';
import 'package:dew_of_hermon/core/access/access_tables.dart';
import 'package:dew_of_hermon/core/utils/firestore_parse.dart';
import 'package:dew_of_hermon/data/models/enums.dart';

/// The access-control port is generated from `src/lib/access-control.ts`, and
/// it decides what every screen in the app will show. These lock in the
/// behaviours that would be dangerous to get wrong.
void main() {
  group('role hierarchy', () {
    test('outranks in the documented order', () {
      expect(UserRole.superAdmin.atLeast(UserRole.member), isTrue);
      expect(UserRole.admin.atLeast(UserRole.departmentLead), isTrue);
      expect(UserRole.departmentLead.atLeast(UserRole.admin), isFalse);
      expect(UserRole.member.atLeast(UserRole.member), isTrue);
    });

    test('reads an unknown wire value as MEMBER, not as an admin', () {
      expect(UserRole.fromWire('SOMETHING_NEW'), UserRole.member);
      expect(UserRole.fromWire(null), UserRole.member);
      expect(UserRole.fromWire(42), UserRole.member);
    });
  });

  group('page access', () {
    test('the Chairperson can edit every page, including unlisted ones', () {
      for (final page in kPageDefinitions) {
        expect(getPageAccess(page.key, UserRole.superAdmin), AccessLevel.edit,
            reason: page.key);
      }
      expect(getPageAccess('not_a_page', UserRole.superAdmin),
          AccessLevel.edit);
    });

    test('an unknown page is denied to everyone below the Chairperson', () {
      expect(getPageAccess('not_a_page', UserRole.admin), AccessLevel.none);
      expect(canAccessPage('not_a_page', UserRole.member), isFalse);
    });

    test('a locked role cannot be overridden by saved config', () {
      final locked = kPageDefinitions
          .where((p) => p.lockedRoles.isNotEmpty)
          .toList();
      // If the table ever stops having locked roles this test is vacuous, so
      // assert the premise as well as the behaviour.
      expect(locked, isNotEmpty,
          reason: 'no page defines lockedRoles — has the table changed?');

      for (final page in locked) {
        for (final entry in page.lockedRoles.entries) {
          final override = <String, Map<UserRole, AccessLevel>>{
            page.key: {entry.key: AccessLevel.none},
          };
          expect(getPageAccess(page.key, entry.key, override), entry.value,
              reason: '${page.key}/${entry.key.wire}');
        }
      }
    });

    test('canEditPage is stricter than canAccessPage', () {
      // view implies access but not edit.
      final permissions = <String, Map<UserRole, AccessLevel>>{
        'dashboard': {UserRole.member: AccessLevel.view},
      };
      expect(canAccessPage('dashboard', UserRole.member, permissions), isTrue);
      expect(canEditPage('dashboard', UserRole.member, permissions), isFalse);
    });
  });

  group('route → page key', () {
    test('exactPageKeyForRoute only matches the page itself', () {
      // The meal line lives under /manage/rops-camp but is reached by the
      // Food Logistics team, who have no access to the camp hub. A prefix
      // match here would lock them out of their own screen.
      final hub = exactPageKeyForRoute('/manage/rops-camp');
      expect(hub, isNotNull);
      expect(exactPageKeyForRoute('/manage/rops-camp/meals'), isNull);
    });

    test('getPageKeyFromRoute does match a deeper path to its section', () {
      expect(getPageKeyFromRoute('/manage/rops-camp/meals'),
          exactPageKeyForRoute('/manage/rops-camp'));
    });
  });

  group('feature access', () {
    const noDepartments = <String, String>{};

    test('the Chairperson passes every feature', () {
      for (final feature in kFeatureDefinitions) {
        expect(
          checkFeatureAccess(feature.key, UserRole.superAdmin, const [],
              const [], noDepartments),
          isTrue,
          reason: feature.key,
        );
      }
    });

    test('an unlisted feature is denied rather than allowed', () {
      expect(
        checkFeatureAccess('invented_feature', UserRole.admin, const [],
            const [], noDepartments),
        isFalse,
      );
    });

    test('a department rule lets someone below the minimum role through', () {
      final rule = kDefaultDepartmentAccessRules.first;
      const deptId = 'dept-1';
      final lookup = {rule.departmentName: deptId};
      final role = rule.allowedRoles.isEmpty
          ? UserRole.member
          : rule.allowedRoles.first;

      final member = rule.requiresLeadership ? const <String>[] : [deptId];
      final leads = rule.requiresLeadership ? [deptId] : const <String>[];

      expect(
        checkFeatureAccess(rule.featureKey, role, member, leads, lookup),
        isTrue,
        reason: '${rule.featureKey} via ${rule.departmentName}',
      );

      // The same person without the department membership does not.
      expect(
        checkFeatureAccess(
            rule.featureKey, role, const [], const [], lookup),
        isFalse,
      );
    });

    test('a leadership rule is not satisfied by mere membership', () {
      final rule = firstWhereOrNull(
          kDefaultDepartmentAccessRules, (r) => r.requiresLeadership);
      expect(rule, isNotNull,
          reason: 'no leadership-only rule — has the table changed?');

      const deptId = 'dept-1';
      final lookup = {rule!.departmentName: deptId};
      final role = rule.allowedRoles.isEmpty
          ? UserRole.member
          : rule.allowedRoles.first;

      expect(
        checkFeatureAccess(rule.featureKey, role, [deptId], const [], lookup),
        isFalse,
        reason: 'membership alone should not satisfy ${rule.featureKey}',
      );
      expect(
        checkFeatureAccess(rule.featureKey, role, const [], [deptId], lookup),
        isTrue,
      );
    });

    test('a rule naming a department that does not exist matches nobody', () {
      final rule = kDefaultDepartmentAccessRules.first;
      expect(
        checkFeatureAccess(rule.featureKey, UserRole.member, const ['dept-1'],
            const ['dept-1'], const {}),
        isFalse,
      );
    });
  });

  group('generated tables', () {
    test('every page permission row covers a defined page', () {
      for (final key in kDefaultPagePermissions.keys) {
        expect(kPageDefinitions.any((p) => p.key == key), isTrue,
            reason: 'permissions for undefined page "$key"');
      }
    });

    test('every defined page has a permission row', () {
      for (final page in kPageDefinitions) {
        expect(kDefaultPagePermissions.containsKey(page.key), isTrue,
            reason: 'no permissions for page "${page.key}"');
      }
    });

    test('every feature has a minimum role', () {
      for (final feature in kFeatureDefinitions) {
        expect(kDefaultFeatureMinRoles.containsKey(feature.key), isTrue,
            reason: 'no minimum role for feature "${feature.key}"');
      }
    });

    test('every department rule points at a defined feature', () {
      for (final rule in kDefaultDepartmentAccessRules) {
        expect(kFeatureDefinitions.any((f) => f.key == rule.featureKey), isTrue,
            reason: 'rule for undefined feature "${rule.featureKey}"');
      }
    });
  });
}
