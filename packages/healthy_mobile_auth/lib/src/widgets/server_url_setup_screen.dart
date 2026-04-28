import 'package:flutter/material.dart';

import '../api/healthy_api_status.dart';
import '../storage/api_base_url_store.dart';
import 'healthy_auth_routes.dart';

/// Collect and validate API base URL, then continue to [routes.root] (startup gate).
class ServerUrlSetupScreen extends StatefulWidget {
  const ServerUrlSetupScreen({
    super.key,
    required this.routes,
    required this.navigate,
    this.showReconnectBanner = false,
    this.onDismissReconnect,
  });

  final HealthyAuthRoutes routes;
  final void Function(String location) navigate;
  final bool showReconnectBanner;
  final void Function()? onDismissReconnect;

  @override
  State<ServerUrlSetupScreen> createState() => _ServerUrlSetupScreenState();
}

class _ServerUrlSetupScreenState extends State<ServerUrlSetupScreen> {
  final _controller = TextEditingController();
  bool _submitting = false;
  String? _fieldError;

  @override
  void initState() {
    super.initState();
    ApiBaseUrlStore.read().then((v) {
      if (v != null && mounted) {
        _controller.text = v;
      }
    });
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() {
      _fieldError = null;
      _submitting = true;
    });
    final trimmed = _controller.text.trim().replaceAll(RegExp(r'/+$'), '');
    try {
      await fetchHealthyPublicStatus(trimmed);
    } catch (_) {
      if (mounted) {
        setState(() {
          _fieldError =
              'Could not load a valid Healthy /status response from that URL. Check the server and try again.';
          _submitting = false;
        });
      }
      return;
    }
    await ApiBaseUrlStore.write(trimmed);
    if (!mounted) return;
    setState(() => _submitting = false);
    widget.navigate(widget.routes.root);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Server URL')),
      body: ListView(
        padding: const EdgeInsets.all(24),
        children: [
          if (widget.showReconnectBanner)
            Semantics(
              label: 'Connection error',
              child: MaterialBanner(
                content: const Text(
                  'Could not reach the saved Healthy API. Update the URL or ensure the server is running.',
                ),
                actions: [
                  TextButton(
                    onPressed: () {
                      widget.onDismissReconnect?.call();
                      widget.navigate(widget.routes.serverUrl);
                    },
                    child: const Text('DISMISS'),
                  ),
                ],
              ),
            ),
          const Text(
            'Enter the base URL of your Healthy API (no trailing path). '
            'It must answer GET /status with the public Healthy contract.',
          ),
          const SizedBox(height: 16),
          TextField(
            controller: _controller,
            decoration: const InputDecoration(
              labelText: 'API base URL',
              hintText: 'http://127.0.0.1:3001',
            ),
            keyboardType: TextInputType.url,
            autocorrect: false,
          ),
          if (_fieldError != null) ...[
            const SizedBox(height: 12),
            Text(
              _fieldError!,
              style: TextStyle(color: Theme.of(context).colorScheme.error),
            ),
          ],
          const SizedBox(height: 24),
          FilledButton(
            onPressed: _submitting ? null : _submit,
            child: Text(_submitting ? 'Checking…' : 'Save and continue'),
          ),
        ],
      ),
    );
  }
}
