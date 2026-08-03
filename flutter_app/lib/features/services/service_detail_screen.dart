import 'package:flutter/material.dart';

/// Stub — implemented by the feature module port (see PORT_PLAN.md).
class ServiceDetailScreen extends StatefulWidget {
  final String id;
  const ServiceDetailScreen({super.key, required this.id});

  @override
  State<ServiceDetailScreen> createState() => _ServiceDetailScreenState();
}

class _ServiceDetailScreenState extends State<ServiceDetailScreen> {
  @override
  Widget build(BuildContext context) {
    return const Center(child: Text('ServiceDetailScreen — coming soon'));
  }
}
