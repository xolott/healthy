import 'package:flutter_test/flutter_test.dart';
import 'package:healthy_mobile_auth/healthy_mobile_auth.dart';

void main() {
  group('HealthyAuthStartupController', () {
    test('routes to server URL when none stored', () async {
      final c = HealthyAuthStartupController(
        readApiBaseUrl: () async => null,
        fetchStatus: (_) async => throw StateError('unreachable'),
        readSessionToken: () async => throw StateError('unreachable'),
        clearSessionToken: () async => throw StateError('unreachable'),
        validateSession: (_, _) async => throw StateError('unreachable'),
      );
      expect(await c.resolve(), HealthyAuthStartupTarget.serverUrl);
    });

    test('setup required clears session and routes to onboarding', () async {
      var cleared = false;
      final c = HealthyAuthStartupController(
        readApiBaseUrl: () async => 'https://api.example',
        fetchStatus: (_) async => HealthyPublicStatus(setupRequired: true),
        readSessionToken: () async => 'tok',
        clearSessionToken: () async {
          cleared = true;
        },
        validateSession: (_, _) async {},
      );
      expect(await c.resolve(), HealthyAuthStartupTarget.onboarding);
      expect(cleared, isTrue);
    });

    test('valid bearer session routes to home', () async {
      final c = HealthyAuthStartupController(
        readApiBaseUrl: () async => 'https://api.example',
        fetchStatus: (_) async => HealthyPublicStatus(setupRequired: false),
        readSessionToken: () async => 'secret',
        clearSessionToken: () async {},
        validateSession: (base, token) async {
          expect(base, 'https://api.example');
          expect(token, 'secret');
        },
      );
      expect(await c.resolve(), HealthyAuthStartupTarget.home);
    });

    test('invalid session clears token and routes to login', () async {
      var cleared = false;
      final c = HealthyAuthStartupController(
        readApiBaseUrl: () async => 'https://api.example',
        fetchStatus: (_) async => HealthyPublicStatus(setupRequired: false),
        readSessionToken: () async => 'bad',
        clearSessionToken: () async {
          cleared = true;
        },
        validateSession: (base, token) async => throw Exception('unauthorized'),
      );
      expect(await c.resolve(), HealthyAuthStartupTarget.login);
      expect(cleared, isTrue);
    });

    test('empty token routes to login', () async {
      final c = HealthyAuthStartupController(
        readApiBaseUrl: () async => 'https://api.example',
        fetchStatus: (_) async => HealthyPublicStatus(setupRequired: false),
        readSessionToken: () async => '',
        clearSessionToken: () async {},
        validateSession: (_, _) async {},
      );
      expect(await c.resolve(), HealthyAuthStartupTarget.login);
    });

    test('status failure routes to reconnect', () async {
      final c = HealthyAuthStartupController(
        readApiBaseUrl: () async => 'https://api.example',
        fetchStatus: (_) async => throw Exception('network'),
        readSessionToken: () async => null,
        clearSessionToken: () async {},
        validateSession: (_, _) async {},
      );
      expect(await c.resolve(), HealthyAuthStartupTarget.serverUrlReconnect);
    });
  });
}
