import 'dart:typed_data';

import 'package:flutter/services.dart' show rootBundle;
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:printing/printing.dart';

import '../config/app_config.dart';
import '../camp/camp_meals.dart';
import '../../data/models/camp.dart';

/// Printable camper QR tag sheets.
///
/// Every camper carries the same `checkInCode` on a badge handed out at
/// arrival, so a camper without a phone is never a special case. Nine tags to
/// an A4 sheet, cut along the guides.
abstract final class CampTagsPdf {
  static const int _perRow = 3;
  static const int _perPage = 9;

  static Future<void> printTags({
    required List<CampRegistration> campers,
    required String campName,
  }) async {
    final doc = await _build(campers: campers, campName: campName);
    await Printing.layoutPdf(
      onLayout: (_) => doc.save(),
      name: '${_slug(campName)}-camp-tags',
    );
  }

  static Future<void> shareTags({
    required List<CampRegistration> campers,
    required String campName,
  }) async {
    final doc = await _build(campers: campers, campName: campName);
    await Printing.sharePdf(
      bytes: await doc.save(),
      filename: '${_slug(campName)}-camp-tags.pdf',
    );
  }

  static Future<pw.Document> _build({
    required List<CampRegistration> campers,
    required String campName,
  }) async {
    // Only campers with a code have anything scannable to print.
    final printable = campers
        .where((c) => (c.checkInCode ?? '').isNotEmpty)
        .toList()
      ..sort((a, b) => a.fullName.compareTo(b.fullName));

    // Bundled TTFs are optional (see pubspec's fonts: block), so fall back to
    // the pdf package's built-in Helvetica rather than failing to produce the
    // sheet at all. Nothing here touches the network: a printed tag sheet has
    // to work from the camp office on no signal.
    final base = await _bundledFont('assets/fonts/DMSans-Regular.ttf');
    final bold = await _bundledFont('assets/fonts/DMSans-Bold.ttf');
    final serif = await _bundledFont('assets/fonts/DMSerifDisplay-Regular.ttf');

    final doc = pw.Document(
      theme: (base != null && bold != null)
          ? pw.ThemeData.withFont(base: base, bold: bold)
          : null,
      title: '$campName — camper tags',
    );

    for (var start = 0; start < printable.length; start += _perPage) {
      final page = printable.skip(start).take(_perPage).toList();
      doc.addPage(
        pw.Page(
          pageFormat: PdfPageFormat.a4,
          margin: const pw.EdgeInsets.all(18),
          build: (context) => pw.Column(
            crossAxisAlignment: pw.CrossAxisAlignment.start,
            children: [
              pw.Text(
                campName,
                style: pw.TextStyle(
                  font: serif ?? bold,
                  fontSize: 15,
                  color: PdfColor.fromInt(0xFF5B3A29),
                ),
              ),
              pw.SizedBox(height: 2),
              pw.Text(
                'Camper tags · cut along the guides · '
                'page ${start ~/ _perPage + 1} of '
                '${(printable.length / _perPage).ceil()}',
                style: const pw.TextStyle(
                  fontSize: 8,
                  color: PdfColor.fromInt(0xFFA0784A),
                ),
              ),
              pw.SizedBox(height: 10),
              pw.Expanded(
                child: pw.GridView(
                  crossAxisCount: _perRow,
                  childAspectRatio: 0.78,
                  crossAxisSpacing: 6,
                  mainAxisSpacing: 6,
                  children: [
                    for (final camper in page) _tag(camper, campName, bold),
                  ],
                ),
              ),
            ],
          ),
        ),
      );
    }

    if (printable.isEmpty) {
      doc.addPage(
        pw.Page(
          pageFormat: PdfPageFormat.a4,
          build: (context) => pw.Center(
            child: pw.Text(
              'No campers with a badge code yet.',
              style: const pw.TextStyle(fontSize: 12),
            ),
          ),
        ),
      );
    }

    return doc;
  }

  static pw.Widget _tag(
    CampRegistration camper,
    String campName,
    pw.Font? bold,
  ) {
    final code = camper.checkInCode!;
    return pw.Container(
      padding: const pw.EdgeInsets.all(8),
      decoration: pw.BoxDecoration(
        border: pw.Border.all(
          color: const PdfColor.fromInt(0xFFDEB887),
          width: 0.7,
        ),
        borderRadius: pw.BorderRadius.circular(6),
      ),
      child: pw.Column(
        mainAxisAlignment: pw.MainAxisAlignment.center,
        children: [
          pw.BarcodeWidget(
            barcode: pw.Barcode.qrCode(),
            data: '${AppConfig.webBaseUrl}/rops-camp/track?code=$code',
            width: 92,
            height: 92,
            drawText: false,
            color: const PdfColor.fromInt(0xFF3E2518),
          ),
          pw.SizedBox(height: 6),
          pw.Text(
            camper.fullName,
            textAlign: pw.TextAlign.center,
            maxLines: 2,
            style: pw.TextStyle(
              font: bold,
              fontSize: 9.5,
              color: const PdfColor.fromInt(0xFF3E2518),
            ),
          ),
          pw.SizedBox(height: 2),
          pw.Text(
            formatMealCode(code),
            style: const pw.TextStyle(
              fontSize: 7.5,
              letterSpacing: 0.6,
              color: PdfColor.fromInt(0xFFA0784A),
            ),
          ),
          pw.SizedBox(height: 3),
          pw.Text(
            'Arrival · meals · gate',
            style: const pw.TextStyle(
              fontSize: 6,
              color: PdfColor.fromInt(0xFFC8963E),
            ),
          ),
        ],
      ),
    );
  }

  /// Load a bundled TTF, or null when it was not bundled.
  static Future<pw.Font?> _bundledFont(String asset) async {
    try {
      final ByteData data = await rootBundle.load(asset);
      return pw.Font.ttf(data);
    } catch (_) {
      return null;
    }
  }
}

String _slug(String value) => value
    .toLowerCase()
    .replaceAll(RegExp(r'[^a-z0-9]+'), '-')
    .replaceAll(RegExp(r'^-|-$'), '');
