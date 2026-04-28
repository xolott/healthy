import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:healthy_workouts/core/api/auth_logout.dart';

void main() {
  test('postAuthLogout POSTs Bearer token and accepts 204', () async {
    final client = MockClient((request) async {
      expect(request.method, 'POST');
      expect(request.url.toString(), 'https://api.example/auth/logout');
      expect(request.headers['authorization'], 'Bearer secret-token');
      return http.Response('', 204);
    });
    await postAuthLogout('https://api.example/', bearerToken: 'secret-token', httpClient: client);
  });

  test('postAuthLogout throws on non-204', () async {
    final client = MockClient((_) async => http.Response('{}', 500));
    expect(
      () => postAuthLogout('https://api.example/', bearerToken: 't', httpClient: client),
      throwsException,
    );
  });
}
