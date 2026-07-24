class ApiConstants {
  static const bool useNgrok = true; // Set to false to use localhost/emulator

  // ── Change this to your machine's IP when testing on a physical device ──
  // Use 10.0.2.2 for Android emulator (maps to localhost)
  static const String _localUrl = 'http://10.0.2.2:8000/api';
  static const String _ngrokUrl = 'https://dawdlingly-pseudoinsane-pa.ngrok-free.dev/api';

  static const String baseUrl = useNgrok ? _ngrokUrl : _localUrl;

  // Auth
  static const String login = '$baseUrl/auth/login';
  static const String register = '$baseUrl/auth/register';

  // Student profile
  static const String profile = '$baseUrl/students/profile';
  static const String avatar = '$baseUrl/students/profile/avatar';
  static const String internships = '$baseUrl/students/internships';
  static const String projects = '$baseUrl/students/projects';
  static const String skills = '$baseUrl/students/skills';

  // Predict
  static const String predict = '$baseUrl/predict';

  // Uploads
  static const String uploadConfig = '$baseUrl/upload/config';
  static const String uploadSign = '$baseUrl/upload/sign';

  static String internshipCertificate(String id) => '$baseUrl/students/internships/$id/certificate';
  static String internshipDelete(String id) => '$baseUrl/students/internships/$id';
  static String projectThumbnail(String id) => '$baseUrl/students/projects/$id/thumbnail';
  static String projectDelete(String id) => '$baseUrl/students/projects/$id';
}

class CloudinaryConstants {
  static const String cloudName = 'ss5gnsii';
  static const String apiKey = '626445917944175';
  static const String uploadPreset = 'mirrormind_unsigned';
  static String get uploadUrl => 'https://api.cloudinary.com/v1_1/$cloudName/auto/upload';
  static String get imageUploadUrl => 'https://api.cloudinary.com/v1_1/$cloudName/image/upload';
  static String get rawUploadUrl => 'https://api.cloudinary.com/v1_1/$cloudName/raw/upload';
}
