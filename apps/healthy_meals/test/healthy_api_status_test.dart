import 'package:flutter_test/flutter_test.dart';
import 'package:healthy_meals/core/api/healthy_api_status.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

void main() {
  group('HealthyPublicStatus.fromJson', () {
    test('parses setup-required response', () {
      final s = HealthyPublicStatus.fromJson({
        'api': {'name': 'healthy-api', 'version': '0.0.1'},
        'setupRequired': true,
      });
      expect(s.setupRequired, isTrue);
    });

    test('parses setup-complete response', () {
      final s = HealthyPublicStatus.fromJson({
        'api': {'name': 'healthy-api', 'version': '0.0.1'},
        'setupRequired': false,
      });
      expect(s.setupRequired, isFalse);
    });

    test('rejects wrong api name', () {
      expect(
        () => HealthyPublicStatus.fromJson({
          'api': {'name': 'other', 'version': '1'},
          'setupRequired': true,
        }),
        throwsA(isA<FormatException>()),
      );
    });
  });

  group('fetchHealthyPublicStatus', () {
    test('throws on non-200 (connection / validation failure)', () async {
      final client = MockClient((_) async => http.Response('', 503));
      await expectLater(
        fetchHealthyPublicStatus('http://example.test', httpClient: client),
        throwsA(isA<HealthyStatusHttpException>()),
      );
    });

    test('strips trailing slash before requesting /status', () async {
      late String capturedPath;
      final client = MockClient((request) async {
        capturedPath = request.url.path;
        return http.Response(
          '{"api":{"name":"healthy-api","version":"0.0.1"},"setupRequired":false}',
          200,
          headers: {'content-type': 'application/json'},
        );
      });
      await fetchHealthyPublicStatus('http://example.test/v1/', httpClient: client);
      expect(capturedPath, '/v1/status');
    });
  });
}
