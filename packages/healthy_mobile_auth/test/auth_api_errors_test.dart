import 'package:flutter_test/flutter_test.dart';
import 'package:healthy_mobile_auth/healthy_mobile_auth.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

void main() {
  test('postOwnerLogin maps 401 to LoginInvalidCredentialsException', () async {
    final client = MockClient((_) async => http.Response('{}', 401));
    expect(
      () => postOwnerLogin(
        'https://api.example/',
        email: 'a@b.c',
        password: 'passwordpassword',
        httpClient: client,
      ),
      throwsA(isA<LoginInvalidCredentialsException>()),
    );
  });

  test('postFirstOwnerSetup maps 404 to SetupNotAvailableException', () async {
    final client = MockClient((_) async => http.Response('{}', 404));
    expect(
      () => postFirstOwnerSetup(
        'https://api.example/',
        displayName: 'Owner',
        email: 'a@b.c',
        password: 'passwordpassword',
        httpClient: client,
      ),
      throwsA(isA<SetupNotAvailableException>()),
    );
  });
}
