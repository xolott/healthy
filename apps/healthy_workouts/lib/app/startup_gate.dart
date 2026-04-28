import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../core/api/auth_me.dart';
import '../core/api/healthy_api_status.dart';
import '../core/config/api_base_url_store.dart';
import '../core/config/session_token_store.dart';

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
        await clearSessionToken();
        context.go('/onboarding');
        return;
      }
      final token = await readSessionToken();
      if (token != null && token.isNotEmpty) {
        try {
          await fetchAuthMe(base, bearerToken: token);
          if (!mounted) return;
          context.go('/home');
          return;
        } catch (_) {
          await clearSessionToken();
        }
      }
      if (!mounted) return;
      context.go('/login');
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
