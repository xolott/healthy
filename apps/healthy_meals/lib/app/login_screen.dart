import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../core/api/auth_me.dart';
import '../core/api/first_owner_setup.dart';
import '../core/api/owner_login.dart';
import '../core/config/api_base_url_store.dart';
import '../core/config/app_identity.dart';
import '../core/config/session_token_store.dart';
import '../shared/widgets/shell_scaffold.dart';

class OwnerLoginScreen extends StatefulWidget {
  const OwnerLoginScreen({super.key});

  @override
  State<OwnerLoginScreen> createState() => _OwnerLoginScreenState();
}

class _OwnerLoginScreenState extends State<OwnerLoginScreen> {
  final _email = TextEditingController();
  final _password = TextEditingController();
  String? _error;
  bool _busy = false;

  @override
  void dispose() {
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
      final r = await postOwnerLogin(
        base,
        email: _email.text.trim(),
        password: _password.text,
      );
      await writeSessionToken(r.sessionToken);
      await fetchAuthMe(base, bearerToken: r.sessionToken);
      if (!mounted) return;
      context.go('/home');
    } on LoginInvalidCredentialsException {
      setState(() => _error = 'Could not sign in. Check your email and password and try again.');
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
    return ShellScaffold(
      title: '${AppIdentity.title} — Sign in',
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Sign in with the owner email and password for this server (password: at least $kPasswordMinLength characters).'),
            if (_error != null) ...[
              const SizedBox(height: 12),
              Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
            ],
            const SizedBox(height: 16),
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
                  : const Text('Sign in'),
            ),
          ],
        ),
      ),
    );
  }
}
