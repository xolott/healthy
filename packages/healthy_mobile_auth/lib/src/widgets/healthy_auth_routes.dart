/// Route paths used by shared auth widgets; apps align [GoRouter] paths to these.
class HealthyAuthRoutes {
  const HealthyAuthRoutes({
    this.root = '/',
    this.serverUrl = '/setup',
    this.onboarding = '/onboarding',
    this.login = '/login',
    this.home = '/home',
  });

  final String root;
  final String serverUrl;
  final String onboarding;
  final String login;
  final String home;
}
