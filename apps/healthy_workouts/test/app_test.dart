import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:healthy_workouts/app/app.dart';

void main() {
  testWidgets('Healthy Workouts renders shell', (WidgetTester tester) async {
    await tester.pumpWidget(
      const ProviderScope(
        child: HealthyWorkoutsApp(),
      ),
    );

    expect(find.textContaining('Healthy Workouts'), findsWidgets);
  });
}
