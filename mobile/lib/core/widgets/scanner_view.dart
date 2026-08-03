import 'dart:async';

import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import '../theme/app_colors.dart';
import '../theme/app_icons.dart';
import '../theme/app_theme.dart';

/// The camera view shared by arrival check-in, the meal serving line and the
/// camp gate.
///
/// Three things every scanner in this app needs and gets here:
///  - a torch toggle, because the gate is manned after dark;
///  - a duplicate debounce, because a QR held in front of the lens fires many
///    times a second and each one would be a round trip;
///  - a manual-entry escape hatch, because a printed badge gets rained on.
class ScannerView extends StatefulWidget {
  const ScannerView({
    super.key,
    required this.onDetect,
    this.overlayLabel,
    this.paused = false,
    this.debounce = const Duration(seconds: 3),
    this.height,
  });

  /// Called with the raw payload. Return quickly — the camera stays live.
  final void Function(String raw) onDetect;

  /// A short instruction drawn under the reticle.
  final String? overlayLabel;

  /// Freeze detection while a result sheet is up.
  final bool paused;

  /// How long the same payload is ignored after a hit.
  final Duration debounce;

  final double? height;

  @override
  State<ScannerView> createState() => _ScannerViewState();
}

class _ScannerViewState extends State<ScannerView> {
  final MobileScannerController _controller = MobileScannerController(
    detectionSpeed: DetectionSpeed.normal,
    formats: const [BarcodeFormat.qrCode],
  );

  String? _lastPayload;
  DateTime? _lastAt;
  bool _torchOn = false;

  @override
  void dispose() {
    unawaited(_controller.dispose());
    super.dispose();
  }

  void _handle(BarcodeCapture capture) {
    if (widget.paused) return;
    for (final barcode in capture.barcodes) {
      final raw = barcode.rawValue;
      if (raw == null || raw.trim().isEmpty) continue;

      // A QR held in front of the lens fires continuously; ignore the same
      // payload for a few seconds so one badge is one scan.
      final now = DateTime.now();
      if (_lastPayload == raw &&
          _lastAt != null &&
          now.difference(_lastAt!) < widget.debounce) {
        return;
      }
      _lastPayload = raw;
      _lastAt = now;
      widget.onDetect(raw);
      return;
    }
  }

  /// Let the caller re-scan the same badge immediately after a correction.
  void clearDebounce() {
    _lastPayload = null;
    _lastAt = null;
  }

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(AppRadius.lux),
      child: SizedBox(
        height: widget.height ?? 320,
        width: double.infinity,
        child: Stack(
          fit: StackFit.expand,
          children: [
            MobileScanner(
              controller: _controller,
              onDetect: _handle,
              errorBuilder: (context, error, child) => _CameraError(
                message: _describe(error),
              ),
            ),
            const _Reticle(),
            if (widget.overlayLabel != null)
              Positioned(
                left: 16,
                right: 16,
                bottom: 16,
                child: Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 14, vertical: 9),
                  decoration: BoxDecoration(
                    color: Colors.black.withValues(alpha: 0.55),
                    borderRadius: BorderRadius.circular(AppRadius.pill),
                  ),
                  child: Text(
                    widget.overlayLabel!,
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      fontSize: 12.5,
                      fontWeight: FontWeight.w600,
                      color: Colors.white,
                    ),
                  ),
                ),
              ),
            Positioned(
              top: 12,
              right: 12,
              child: _RoundButton(
                icon: _torchOn ? AppIcons.flashOn : AppIcons.flashOff,
                active: _torchOn,
                tooltip: _torchOn ? 'Torch off' : 'Torch on',
                onTap: () async {
                  await _controller.toggleTorch();
                  if (mounted) setState(() => _torchOn = !_torchOn);
                },
              ),
            ),
            Positioned(
              top: 12,
              left: 12,
              child: _RoundButton(
                icon: AppIcons.camera,
                tooltip: 'Switch camera',
                onTap: () => _controller.switchCamera(),
              ),
            ),
            if (widget.paused)
              ColoredBox(
                color: Colors.black.withValues(alpha: 0.45),
                child: const Center(
                  child: Text(
                    'Paused',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  static String _describe(MobileScannerException error) {
    return switch (error.errorCode) {
      MobileScannerErrorCode.permissionDenied =>
        'Camera access is off for this app. Turn it on in your phone settings, '
            'then come back — or type the code in by hand below.',
      MobileScannerErrorCode.unsupported =>
        'This device cannot scan QR codes. Type the code in by hand below.',
      _ => 'The camera could not start. Type the code in by hand below.',
    };
  }
}

class _CameraError extends StatelessWidget {
  const _CameraError({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return ColoredBox(
      color: AppColors.clay900,
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(AppIcons.camera, size: 34, color: AppColors.clay300),
            const SizedBox(height: 14),
            Text(
              message,
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 13,
                height: 1.55,
                color: AppColors.cream.withValues(alpha: 0.85),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Reticle extends StatelessWidget {
  const _Reticle();

  @override
  Widget build(BuildContext context) {
    return IgnorePointer(
      child: Center(
        child: SizedBox(
          height: 190,
          width: 190,
          child: CustomPaint(painter: _ReticlePainter()),
        ),
      ),
    );
  }
}

class _ReticlePainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = AppColors.goldLight
      ..strokeWidth = 3.5
      ..strokeCap = StrokeCap.round
      ..style = PaintingStyle.stroke;

    const arm = 30.0;
    final w = size.width;
    final h = size.height;

    // Four corner brackets, the universal "aim here".
    canvas.drawPath(
        Path()
          ..moveTo(0, arm)
          ..lineTo(0, 0)
          ..lineTo(arm, 0),
        paint);
    canvas.drawPath(
        Path()
          ..moveTo(w - arm, 0)
          ..lineTo(w, 0)
          ..lineTo(w, arm),
        paint);
    canvas.drawPath(
        Path()
          ..moveTo(w, h - arm)
          ..lineTo(w, h)
          ..lineTo(w - arm, h),
        paint);
    canvas.drawPath(
        Path()
          ..moveTo(arm, h)
          ..lineTo(0, h)
          ..lineTo(0, h - arm),
        paint);
  }

  @override
  bool shouldRepaint(_ReticlePainter oldDelegate) => false;
}

class _RoundButton extends StatelessWidget {
  const _RoundButton({
    required this.icon,
    required this.onTap,
    required this.tooltip,
    this.active = false,
  });

  final IconData icon;
  final VoidCallback onTap;
  final String tooltip;
  final bool active;

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: tooltip,
      child: Material(
        color: active
            ? AppColors.gold.withValues(alpha: 0.9)
            : Colors.black.withValues(alpha: 0.5),
        shape: const CircleBorder(),
        child: InkWell(
          onTap: onTap,
          customBorder: const CircleBorder(),
          child: Padding(
            padding: const EdgeInsets.all(10),
            child: Icon(icon,
                size: 19,
                color: active ? AppColors.clay900 : Colors.white),
          ),
        ),
      ),
    );
  }
}

/// The manual-entry field every scanner screen pairs with the camera.
class ManualCodeEntry extends StatefulWidget {
  const ManualCodeEntry({
    super.key,
    required this.onSubmit,
    this.label = 'Or type the code',
    this.hint = 'ABCD-EFGH-JKMN',
    this.busy = false,
  });

  final void Function(String code) onSubmit;
  final String label;
  final String hint;
  final bool busy;

  @override
  State<ManualCodeEntry> createState() => _ManualCodeEntryState();
}

class _ManualCodeEntryState extends State<ManualCodeEntry> {
  final _controller = TextEditingController();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _submit() {
    final value = _controller.text.trim();
    if (value.isEmpty) return;
    widget.onSubmit(value);
    _controller.clear();
  }

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Padding(
                padding: const EdgeInsets.only(bottom: 7),
                child: Text(
                  widget.label,
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: AppColors.clay600,
                  ),
                ),
              ),
              TextField(
                controller: _controller,
                textCapitalization: TextCapitalization.characters,
                textInputAction: TextInputAction.go,
                onSubmitted: (_) => _submit(),
                style: const TextStyle(
                  fontSize: 15,
                  letterSpacing: 1.2,
                  fontWeight: FontWeight.w600,
                ),
                decoration: InputDecoration(hintText: widget.hint),
              ),
            ],
          ),
        ),
        const SizedBox(width: 10),
        SizedBox(
          height: 50,
          child: FilledButton(
            onPressed: widget.busy ? null : _submit,
            child: widget.busy
                ? const SizedBox(
                    height: 18,
                    width: 18,
                    child: CircularProgressIndicator(
                        strokeWidth: 2, color: Colors.white),
                  )
                : const Icon(AppIcons.check, size: 19),
          ),
        ),
      ],
    );
  }
}
