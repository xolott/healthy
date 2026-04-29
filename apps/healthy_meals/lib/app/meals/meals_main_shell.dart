import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:healthy_mobile_auth/healthy_mobile_auth.dart';

import '../../core/config/app_identity.dart';
import '../../core/navigation/meals_destinations.dart';
import 'meals_bottom_nav.dart';

class MealsMainShell extends StatelessWidget {
  const MealsMainShell({
    super.key,
    required this.navigationShell,
  });

  final StatefulNavigationShell navigationShell;

  static String _titleForIndex(int index) {
    return switch (index) {
      0 => MealsDestinations.homeLabel,
      1 => MealsDestinations.foodLogLabel,
      2 => MealsDestinations.pantryLabel,
      3 => MealsDestinations.progressLabel,
      _ => AppIdentity.title,
    };
  }

  Future<void> _signOut(BuildContext context) async {
    final base = await ApiBaseUrlStore.read();
    final token = await readSessionToken();
    if (base != null && token != null && token.isNotEmpty) {
      try {
        await postAuthLogout(base, bearerToken: token);
      } catch (e) {
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Could not sign out on the server: $e')),
          );
        }
        return;
      }
    }
    await clearSessionToken();
    if (context.mounted) {
      context.go('/login');
    }
  }

  @override
  Widget build(BuildContext context) {
    final index = navigationShell.currentIndex;
    return Scaffold(
      appBar: AppBar(
        title: Text(_titleForIndex(index)),
        actions: [
          IconButton(
            icon: const Icon(Icons.logout),
            tooltip: 'Sign out',
            onPressed: () => _signOut(context),
          ),
        ],
      ),
      body: navigationShell,
      bottomNavigationBar: MealsBottomNav(
        currentIndex: index,
        onDestinationSelected: navigationShell.goBranch,
        onCenterPlus: () {
          navigationShell.goBranch(1);
        },
      ),
    );
  }
}
