import 'package:http/http.dart' as http;

Future<void> postAuthLogout(
  String apiBaseUrl, {
  required String bearerToken,
  http.Client? httpClient,
}) async {
  final base = apiBaseUrl.replaceAll(RegExp(r'/+$'), '');
  final uri = Uri.parse('$base/auth/logout');
  final client = httpClient ?? http.Client();
  final ownsClient = httpClient == null;
  try {
    final res = await client.post(
      uri,
      headers: {'Authorization': 'Bearer $bearerToken'},
    );
    if (res.statusCode == 503) {
      throw Exception('service_unavailable');
    }
    if (res.statusCode != 204) {
      throw Exception('HTTP ${res.statusCode}');
    }
  } finally {
    if (ownsClient) {
      client.close();
    }
  }
}
