import 'dart:typed_data';

import 'package:flutter/services.dart' show rootBundle;
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:printing/printing.dart';

import '../../core/utils/dates.dart';
import 'latreuo_models.dart';

/// The worship cycle sheet the team carries — one page the leader can print,
/// WhatsApp, or hold on a music stand.
abstract final class LatreuoPdf {
  static const _clay700 = PdfColor.fromInt(0xFF5B3A29);
  static const _clay500 = PdfColor.fromInt(0xFFA0784A);
  static const _clay300 = PdfColor.fromInt(0xFFDEB887);
  static const _gold = PdfColor.fromInt(0xFFC8963E);

  static Future<void> share(LatreuoCycle cycle) async {
    final doc = await _build(cycle);
    await Printing.sharePdf(
      bytes: await doc.save(),
      filename: '${_slug(cycle.cycleName)}-latreuo.pdf',
    );
  }

  static Future<void> print(LatreuoCycle cycle) async {
    final doc = await _build(cycle);
    await Printing.layoutPdf(
      onLayout: (_) => doc.save(),
      name: '${_slug(cycle.cycleName)}-latreuo',
    );
  }

  static Future<pw.Document> _build(LatreuoCycle cycle) async {
    final base = await _bundledFont('assets/fonts/DMSans-Regular.ttf');
    final bold = await _bundledFont('assets/fonts/DMSans-Bold.ttf');
    final serif = await _bundledFont('assets/fonts/DMSerifDisplay-Regular.ttf');

    final doc = pw.Document(
      theme: (base != null && bold != null)
          ? pw.ThemeData.withFont(base: base, bold: bold)
          : null,
      title: cycle.cycleName.isEmpty ? 'Worship cycle' : cycle.cycleName,
    );

    doc.addPage(
      pw.MultiPage(
        pageFormat: PdfPageFormat.a4,
        margin: const pw.EdgeInsets.fromLTRB(36, 36, 36, 36),
        build: (context) => [
          pw.Text(
            cycle.cycleName.isEmpty ? 'Worship cycle' : cycle.cycleName,
            style: pw.TextStyle(font: serif ?? bold, fontSize: 24,
                color: _clay700),
          ),
          if (cycle.preparedBy.isNotEmpty) ...[
            pw.SizedBox(height: 3),
            pw.Text(
              'Prepared by ${cycle.preparedBy}',
              style: const pw.TextStyle(fontSize: 10, color: _clay500),
            ),
          ],
          pw.SizedBox(height: 18),

          _sunday('First Sunday', cycle.firstSunday, bold),
          pw.SizedBox(height: 16),
          _sunday('Second Sunday', cycle.secondSunday, bold),

          if (_hasUniforms(cycle.uniforms)) ...[
            pw.SizedBox(height: 16),
            _heading('Uniforms', bold),
            pw.SizedBox(height: 6),
            _uniformRow('First Sunday', cycle.uniforms.firstSundayGents,
                cycle.uniforms.firstSundayLadies, bold),
            _uniformRow('Second Sunday', cycle.uniforms.secondSundayGents,
                cycle.uniforms.secondSundayLadies, bold),
            if (cycle.uniforms.notes.isNotEmpty) ...[
              pw.SizedBox(height: 4),
              pw.Text(cycle.uniforms.notes,
                  style: const pw.TextStyle(fontSize: 9.5, color: _clay500)),
            ],
          ],

          if (cycle.rehearsals.isNotEmpty) ...[
            pw.SizedBox(height: 16),
            _heading('Rehearsals', bold),
            pw.SizedBox(height: 6),
            for (final r in cycle.rehearsals)
              pw.Padding(
                padding: const pw.EdgeInsets.only(bottom: 3),
                child: pw.Text(
                  [
                    D.dayMedium(D.fromIso(r.date)),
                    if (r.time.isNotEmpty) r.time,
                    if (r.location.isNotEmpty) r.location,
                    if (r.coordinator.isNotEmpty) 'led by ${r.coordinator}',
                    if (r.focus.isNotEmpty) r.focus,
                  ].join(' · '),
                  style: const pw.TextStyle(fontSize: 10, color: _clay700),
                ),
              ),
          ],

          if (cycle.scriptureReference.isNotEmpty ||
              cycle.prayerDirection.isNotEmpty) ...[
            pw.SizedBox(height: 16),
            _heading('Scripture & prayer', bold),
            pw.SizedBox(height: 6),
            if (cycle.scriptureReference.isNotEmpty)
              pw.Text(
                cycle.scriptureReference,
                style: pw.TextStyle(font: bold, fontSize: 11,
                    color: _clay700),
              ),
            if (cycle.scriptureText.isNotEmpty) ...[
              pw.SizedBox(height: 3),
              pw.Text(
                cycle.scriptureText,
                style: const pw.TextStyle(
                    fontSize: 10, lineSpacing: 3, color: _clay500),
              ),
            ],
            if (cycle.prayerDirection.isNotEmpty) ...[
              pw.SizedBox(height: 8),
              pw.Text(
                cycle.prayerDirection,
                style: const pw.TextStyle(
                    fontSize: 10, lineSpacing: 3, color: _clay700),
              ),
            ],
          ],
        ],
      ),
    );

    return doc;
  }

  static bool _hasUniforms(Uniforms u) =>
      u.firstSundayGents.isNotEmpty ||
      u.firstSundayLadies.isNotEmpty ||
      u.secondSundayGents.isNotEmpty ||
      u.secondSundayLadies.isNotEmpty ||
      u.notes.isNotEmpty;

  static pw.Widget _heading(String text, pw.Font? bold) => pw.Column(
        crossAxisAlignment: pw.CrossAxisAlignment.start,
        children: [
          pw.Text(
            text.toUpperCase(),
            style: pw.TextStyle(
              font: bold,
              fontSize: 8.5,
              letterSpacing: 1.4,
              color: _gold,
            ),
          ),
          pw.SizedBox(height: 3),
          pw.Container(height: 0.7, color: _clay300),
        ],
      );

  static pw.Widget _sunday(String label, SundayPlan plan, pw.Font? bold) {
    final praise = plan.praise.where((s) => !s.isEmpty).toList();
    final worship = plan.worship.where((s) => !s.isEmpty).toList();

    return pw.Column(
      crossAxisAlignment: pw.CrossAxisAlignment.start,
      children: [
        _heading(
          '$label${plan.date.isEmpty ? '' : ' · ${D.medium(D.fromIso(plan.date))}'}',
          bold,
        ),
        pw.SizedBox(height: 7),
        if (praise.isEmpty && worship.isEmpty)
          pw.Text('No songs chosen.',
              style: const pw.TextStyle(fontSize: 10, color: _clay300))
        else ...[
          if (praise.isNotEmpty) _songList('Praise', praise, bold),
          if (worship.isNotEmpty) ...[
            pw.SizedBox(height: 6),
            _songList('Worship', worship, bold),
          ],
        ],
        if (!plan.specialItem.isEmpty) ...[
          pw.SizedBox(height: 6),
          pw.Text(
            'Special item: ${plan.specialItem.title}'
            '${plan.specialItem.responsible.isEmpty ? '' : ' — ${plan.specialItem.responsible}'}',
            style: const pw.TextStyle(fontSize: 10, color: _clay500),
          ),
        ],
      ],
    );
  }

  static pw.Widget _songList(String label, List<Song> songs, pw.Font? bold) =>
      pw.Column(
        crossAxisAlignment: pw.CrossAxisAlignment.start,
        children: [
          pw.Text(
            label,
            style: pw.TextStyle(font: bold, fontSize: 9.5, color: _clay500),
          ),
          pw.SizedBox(height: 2),
          for (final song in songs)
            pw.Padding(
              padding: const pw.EdgeInsets.only(bottom: 2, left: 8),
              child: pw.Text(
                '${song.title}'
                '${song.leader.isEmpty ? '' : ' — ${song.leader}'}',
                style: const pw.TextStyle(fontSize: 10.5, color: _clay700),
              ),
            ),
        ],
      );

  static pw.Widget _uniformRow(
    String label,
    String gents,
    String ladies,
    pw.Font? bold,
  ) {
    if (gents.isEmpty && ladies.isEmpty) return pw.SizedBox();
    return pw.Padding(
      padding: const pw.EdgeInsets.only(bottom: 3),
      child: pw.Row(
        crossAxisAlignment: pw.CrossAxisAlignment.start,
        children: [
          pw.SizedBox(
            width: 90,
            child: pw.Text(
              label,
              style: pw.TextStyle(font: bold, fontSize: 9.5, color: _clay500),
            ),
          ),
          pw.Expanded(
            child: pw.Text(
              [
                if (gents.isNotEmpty) 'Gents: $gents',
                if (ladies.isNotEmpty) 'Ladies: $ladies',
              ].join('  ·  '),
              style: const pw.TextStyle(fontSize: 10, color: _clay700),
            ),
          ),
        ],
      ),
    );
  }

  static Future<pw.Font?> _bundledFont(String asset) async {
    try {
      final ByteData data = await rootBundle.load(asset);
      return pw.Font.ttf(data);
    } catch (_) {
      return null;
    }
  }
}

String _slug(String value) {
  final slug = value
      .toLowerCase()
      .replaceAll(RegExp(r'[^a-z0-9]+'), '-')
      .replaceAll(RegExp(r'^-|-$'), '');
  return slug.isEmpty ? 'worship-cycle' : slug;
}
