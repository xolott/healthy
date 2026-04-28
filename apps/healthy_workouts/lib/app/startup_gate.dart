import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../core/api/healthy_api_status.dart';
import '../core/config/api_base_url_store.dart';

/// First paint: read stored API URL, validate with `/status`, then route the shell.
class StartupGate extends StatefulWidget {
  const StartupGate({super.key});

  @override
  State<StartupGate> createState() => _StartupGateState();
}

class _StartupGateState extends State<StartupGate> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _route());
  }

  Future<void> _route() async {
    final base = await ApiBaseUrlStore.read();
    if (!mounted) return;
    if (base == null) {
      context.go('/setup');
      return;
    }
    try {
      final status = await fetchHealthyPublicStatus(base);
      if (!mounted) return;
      if (status.setupRequired) {
        context.go('/onboarding');
      } else {
        context.go('/login');
      }
    } catch (_) {
      if (!mounted) return;
      context.go('/setup?reconnect=1');
    }
  }

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      body: Center(
        child: CircularProgressIndicator(),
      ),
    );
  }
}
