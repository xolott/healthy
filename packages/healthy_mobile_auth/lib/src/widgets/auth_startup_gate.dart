import 'package:flutter/material.dart';

import '../startup/healthy_auth_startup_controller.dart';
import 'healthy_auth_routes.dart';

/// First paint: read stored API URL, validate with `/status`, then invoke [navigate].
class AuthStartupGate extends StatefulWidget {
  const AuthStartupGate({
    super.key,
    required this.routes,
    required this.navigate,
    this.controller,
  });

  final HealthyAuthRoutes routes;
  final void Function(String location) navigate;
  final HealthyAuthStartupController? controller;

  @override
  State<AuthStartupGate> createState() => _AuthStartupGateState();
}

class _AuthStartupGateState extends State<AuthStartupGate> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _route());
  }

  Future<void> _route() async {
    final c = widget.controller ?? HealthyAuthStartupController.withDefaultStores();
    final target = await c.resolve();
    if (!mounted) return;
    switch (target) {
      case HealthyAuthStartupTarget.serverUrl:
        widget.navigate(widget.routes.serverUrl);
      case HealthyAuthStartupTarget.onboarding:
        widget.navigate(widget.routes.onboarding);
      case HealthyAuthStartupTarget.home:
        widget.navigate(widget.routes.home);
      case HealthyAuthStartupTarget.login:
        widget.navigate(widget.routes.login);
      case HealthyAuthStartupTarget.serverUrlReconnect:
        widget.navigate('${widget.routes.serverUrl}?reconnect=1');
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
