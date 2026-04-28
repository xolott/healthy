import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:healthy_meals/app/app.dart';

void main() {
  testWidgets('Healthy Meals renders shell', (WidgetTester tester) async {
    await tester.pumpWidget(
      const ProviderScope(
        child: HealthyMealsApp(),
      ),
    );

    expect(find.textContaining('Healthy Meals'), findsWidgets);
  });
}
