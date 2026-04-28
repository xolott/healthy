import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:healthy_mobile_auth/healthy_mobile_auth.dart';

void main() {
  group('AuthFirstOwnerOnboardingScreen', () {
    testWidgets('successful setup navigates to login, not home', (tester) async {
      final navigated = <String>[];
      await tester.pumpWidget(
        MaterialApp(
          home: AuthFirstOwnerOnboardingScreen(
            routes: const HealthyAuthRoutes(),
            navigate: navigated.add,
            appProductTitle: 'Test',
            readApiBaseUrlFn: () async => 'https://api.example',
            postFirstOwnerSetupFn: (_, {required displayName, required email, required password, httpClient}) async {
              return FirstOwnerSuccess(
                user: {'email': email},
                sessionToken: 'session-not-persisted',
                expiresAtIso: '2099-01-01T00:00:00Z',
              );
            },
          ),
        ),
      );
      final fields = find.byType(TextField);
      await tester.enterText(fields.at(0), 'Owner Name');
      await tester.enterText(fields.at(1), 'owner@example.com');
      await tester.enterText(fields.at(2), 'passwordpassword');
      await tester.tap(find.text('Create owner account'));
      await tester.pumpAndSettle();

      expect(navigated, ['/login']);
      expect(navigated, isNot(contains('/home')));
    });

    testWidgets('successful setup uses semantic labels then routes to login', (tester) async {
      final navigated = <String>[];
      await tester.pumpWidget(
        MaterialApp(
          home: AuthFirstOwnerOnboardingScreen(
            routes: const HealthyAuthRoutes(),
            navigate: navigated.add,
            appProductTitle: 'Test',
            readApiBaseUrlFn: () async => 'https://api.example',
            postFirstOwnerSetupFn: (_, {required displayName, required email, required password, httpClient}) async {
              return FirstOwnerSuccess(
                user: {'email': email},
                sessionToken: 'session-not-persisted',
                expiresAtIso: '2099-01-01T00:00:00Z',
              );
            },
          ),
        ),
      );
      await tester.enterText(find.bySemanticsLabel('Display name'), 'Owner Name');
      await tester.enterText(find.bySemanticsLabel('Email'), 'owner@example.com');
      await tester.enterText(find.bySemanticsLabel('Password'), 'passwordpassword');
      await tester.tap(find.text('Create owner account'));
      await tester.pumpAndSettle();

      expect(navigated, ['/login']);
      expect(navigated, isNot(contains('/home')));
    });

    testWidgets('password policy error does not navigate', (tester) async {
      final navigated = <String>[];
      await tester.pumpWidget(
        MaterialApp(
          home: AuthFirstOwnerOnboardingScreen(
            routes: const HealthyAuthRoutes(),
            navigate: navigated.add,
            appProductTitle: 'Test',
            readApiBaseUrlFn: () async => 'https://api.example',
            postFirstOwnerSetupFn: (_, {required displayName, required email, required password, httpClient}) async {
              throw PasswordPolicyException('too short', minLength: 12);
            },
          ),
        ),
      );
      final fields = find.byType(TextField);
      await tester.enterText(fields.at(0), 'Owner Name');
      await tester.enterText(fields.at(1), 'owner@example.com');
      await tester.enterText(fields.at(2), 'passwordpassword');
      await tester.tap(find.text('Create owner account'));
      await tester.pumpAndSettle();

      expect(navigated, isEmpty);
      expect(find.text('too short'), findsOneWidget);
    });

    testWidgets('setup not available shows message and does not navigate', (tester) async {
      final navigated = <String>[];
      await tester.pumpWidget(
        MaterialApp(
          home: AuthFirstOwnerOnboardingScreen(
            routes: const HealthyAuthRoutes(),
            navigate: navigated.add,
            appProductTitle: 'Test',
            readApiBaseUrlFn: () async => 'https://api.example',
            postFirstOwnerSetupFn: (_, {required displayName, required email, required password, httpClient}) async {
              throw SetupNotAvailableException();
            },
          ),
        ),
      );
      final fields = find.byType(TextField);
      await tester.enterText(fields.at(0), 'Owner Name');
      await tester.enterText(fields.at(1), 'owner@example.com');
      await tester.enterText(fields.at(2), 'passwordpassword');
      await tester.tap(find.text('Create owner account'));
      await tester.pumpAndSettle();

      expect(navigated, isEmpty);
      expect(find.textContaining('no longer available'), findsOneWidget);
    });
  });
}
