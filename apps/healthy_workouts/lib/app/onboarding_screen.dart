import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../core/api/auth_me.dart';
import '../core/api/first_owner_setup.dart';
import '../core/config/api_base_url_store.dart';
import '../core/config/app_identity.dart';
import '../core/config/session_token_store.dart';
import '../shared/widgets/shell_scaffold.dart';

class FirstOwnerOnboardingScreen extends StatefulWidget {
  const FirstOwnerOnboardingScreen({super.key});

  @override
  State<FirstOwnerOnboardingScreen> createState() => _FirstOwnerOnboardingScreenState();
}

class _FirstOwnerOnboardingScreenState extends State<FirstOwnerOnboardingScreen> {
  final _display = TextEditingController();
  final _email = TextEditingController();
  final _password = TextEditingController();
  String? _error;
  bool _busy = false;

  static const _passwordMin = 12;

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
    if (_password.text.length < _passwordMin) {
      setState(() => _error = 'Password must be at least $_passwordMin characters.');
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
      context.go('/home');
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
    return ShellScaffold(
      title: '${AppIdentity.title} — First owner',
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'This server has no active owner yet. Create the initial account. '
              'Password: at least $_passwordMin characters.',
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
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Text('Create owner and sign in'),
            ),
          ],
        ),
      ),
    );
  }
}
