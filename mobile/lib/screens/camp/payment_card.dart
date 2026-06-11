import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../models/camp.dart';
import '../../theme/app_theme.dart';
import '../../widgets/common.dart';

/// Mobile-money payment instructions for a camp registration — same
/// amount/reference/number rules as the web PaymentInstructionsCard.
class CampPaymentCard extends StatelessWidget {
  const CampPaymentCard({
    super.key,
    required this.registrationId,
    required this.camperName,
    required this.amount,
    required this.currency,
  });

  final String registrationId;
  final String camperName;
  final num amount;
  final String currency;

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    final reference = campPaymentReference(registrationId);

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'PAYMENT INSTRUCTIONS',
              style: textTheme.labelSmall?.copyWith(
                color: PWColors.goldDark,
                letterSpacing: 2,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 12),
            _row(context, 'Amount', '$currency ${amount.toStringAsFixed(0)}'),
            _row(context, 'Reference', reference, copyable: true),
            _row(context, 'Method', 'Mobile Money'),
            _row(context, 'Send payment & POP to', campPaymentNumber,
                copyable: true),
            const Divider(height: 24),
            Text(
              'Send your mobile money payment and proof of payment (POP) to '
              '$campPaymentNumber. Include the reference $reference so we '
              "can match your transaction to $camperName's registration.",
              style: textTheme.bodySmall
                  ?.copyWith(color: PWColors.clay500, height: 1.5),
            ),
          ],
        ),
      ),
    );
  }

  Widget _row(BuildContext context, String label, String value,
      {bool copyable = false}) {
    final textTheme = Theme.of(context).textTheme;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          Expanded(
            flex: 2,
            child: Text(
              label,
              style: textTheme.bodySmall?.copyWith(color: PWColors.clay400),
            ),
          ),
          Expanded(
            flex: 3,
            child: Text(
              value,
              style: textTheme.bodyMedium?.copyWith(
                fontWeight: FontWeight.w600,
                color: PWColors.clay700,
              ),
            ),
          ),
          if (copyable)
            InkWell(
              borderRadius: BorderRadius.circular(8),
              onTap: () {
                Clipboard.setData(ClipboardData(text: value));
                showAppSnackBar(context, 'Copied $value');
              },
              child: const Padding(
                padding: EdgeInsets.all(4),
                child:
                    Icon(Icons.copy, size: 16, color: PWColors.clay400),
              ),
            ),
        ],
      ),
    );
  }
}
