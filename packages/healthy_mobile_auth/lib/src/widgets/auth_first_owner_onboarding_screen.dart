import 'package:flutter/material.dart';

import '../api/auth_me.dart';
import '../api/first_owner_setup.dart';
import '../storage/api_base_url_store.dart';
import '../storage/session_token_store.dart';
import 'auth_shell_scaffold.dart';
import 'healthy_auth_routes.dart';

/// First-owner onboarding when the server reports setup required.
class AuthFirstOwnerOnboardingScreen extends StatefulWidget {
  const AuthFirstOwnerOnboardingScreen({
    super.key,
    required this.routes,
    required this.navigate,
    required this.appProductTitle,
  });

  final HealthyAuthRoutes routes;
  final void Function(String location) navigate;
  final String appProductTitle;

  @override
  State<AuthFirstOwnerOnboardingScreen> createState() => _AuthFirstOwnerOnboardingScreenState();
}

class _AuthFirstOwnerOnboardingScreenState extends State<AuthFirstOwnerOnboardingScreen> {
  final _display = TextEditingController();
  final _email = TextEditingController();
  final _password = TextEditingController();
  String? _error;
  bool _busy = false;

  @override
  void dispose() {
    _display.dispose();
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() {
      _error = null;
    });
    final base = await ApiBaseUrlStore.read();
    if (base == null) {
      setState(() => _error = 'Missing API URL');
      return;
    }
    if (_password.text.length < kPasswordMinLength) {
      setState(() => _error = 'Password must be at least $kPasswordMinLength characters.');
      return;
    }
    setState(() => _busy = true);
    try {
      final r = await postFirstOwnerSetup(
        base,
        displayName: _display.text.trim(),
        email: _email.text.trim(),
        password: _password.text,
      );
      await writeSessionToken(r.sessionToken);
      await fetchAuthMe(base, bearerToken: r.sessionToken);
      if (!mounted) return;
      widget.navigate(widget.routes.home);
    } on PasswordPolicyException catch (e) {
      setState(() => _error = e.message);
    } on SetupNotAvailableException {
      setState(
        () => _error = 'Setup is no longer available. Try signing in if the server is already configured.',
      );
    } catch (_) {
      setState(() => _error = 'Request failed. Check the server and try again.');
    } finally {
      if (mounted) {
        setState(() => _busy = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return AuthShellScaffold(
      title: '${widget.appProductTitle} — First owner',
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'This server has no active owner yet. Create the initial account. '
              'Password: at least $kPasswordMinLength characters.',
            ),
            if (_error != null) ...[
              const SizedBox(height: 12),
              Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
            ],
            const SizedBox(height: 16),
            TextField(
              controller: _display,
              decoration: const InputDecoration(labelText: 'Display name'),
              textInputAction: TextInputAction.next,
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _email,
              decoration: const InputDecoration(labelText: 'Email'),
              keyboardType: TextInputType.emailAddress,
              textInputAction: TextInputAction.next,
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _password,
              decoration: const InputDecoration(labelText: 'Password'),
              obscureText: true,
            ),
            const SizedBox(height: 20),
            FilledButton(
              onPressed: _busy ? null : _submit,
              child: _busy
                  ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))
                  : const Text('Create owner and sign in'),
            ),
          ],
        ),
      ),
    );
  }
}
