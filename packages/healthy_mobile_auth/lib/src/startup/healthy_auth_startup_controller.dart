import 'package:http/http.dart' as http;

import '../api/auth_me.dart';
import '../api/healthy_api_status.dart';
import '../storage/api_base_url_store.dart';
import '../storage/session_token_store.dart';

/// Where the app should route after evaluating stored URL, status, and session.
enum HealthyAuthStartupTarget {
  serverUrl,
  onboarding,
  home,
  login,
  serverUrlReconnect,
}

/// Encapsulates startup routing logic for injectable tests.
class HealthyAuthStartupController {
  HealthyAuthStartupController({
    required Future<String?> Function() readApiBaseUrl,
    required Future<HealthyPublicStatus> Function(String base) fetchStatus,
    required Future<String?> Function() readSessionToken,
    required Future<void> Function() clearSessionToken,
    required Future<void> Function(String base, String token) validateSession,
  })  : _readApiBaseUrl = readApiBaseUrl,
        _fetchStatus = fetchStatus,
        _readSessionToken = readSessionToken,
        _clearSessionToken = clearSessionToken,
        _validateSession = validateSession;

  final Future<String?> Function() _readApiBaseUrl;
  final Future<HealthyPublicStatus> Function(String base) _fetchStatus;
  final Future<String?> Function() _readSessionToken;
  final Future<void> Function() _clearSessionToken;
  final Future<void> Function(String base, String token) _validateSession;

  factory HealthyAuthStartupController.withDefaultStores({http.Client? httpClient}) {
    return HealthyAuthStartupController(
      readApiBaseUrl: ApiBaseUrlStore.read,
      fetchStatus: (base) => fetchHealthyPublicStatus(base, httpClient: httpClient),
      readSessionToken: readSessionToken,
      clearSessionToken: clearSessionToken,
      validateSession: (base, token) =>
          fetchAuthMe(base, bearerToken: token, httpClient: httpClient).then((_) {}),
    );
  }

  Future<HealthyAuthStartupTarget> resolve() async {
    final base = await _readApiBaseUrl();
    if (base == null) {
      return HealthyAuthStartupTarget.serverUrl;
    }
    try {
      final status = await _fetchStatus(base);
      if (status.setupRequired) {
        await _clearSessionToken();
        return HealthyAuthStartupTarget.onboarding;
      }
      final token = await _readSessionToken();
      if (token != null && token.isNotEmpty) {
        try {
          await _validateSession(base, token);
          return HealthyAuthStartupTarget.home;
        } catch (_) {
          await _clearSessionToken();
        }
      }
      return HealthyAuthStartupTarget.login;
    } catch (_) {
      return HealthyAuthStartupTarget.serverUrlReconnect;
    }
  }
}
