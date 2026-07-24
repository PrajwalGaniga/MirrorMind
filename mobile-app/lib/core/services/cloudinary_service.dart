import 'dart:io';
import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';
import 'dart:convert';
import '../constants/api.dart';

enum CloudinaryFolder { avatars, thumbnails, certificates }

class CloudinaryService {
  static final CloudinaryService _instance = CloudinaryService._internal();
  factory CloudinaryService() => _instance;
  CloudinaryService._internal();

  String _folderName(CloudinaryFolder folder) {
    switch (folder) {
      case CloudinaryFolder.avatars:
        return 'mirrormind/avatars';
      case CloudinaryFolder.thumbnails:
        return 'mirrormind/thumbnails';
      case CloudinaryFolder.certificates:
        return 'mirrormind/certificates';
    }
  }

  String _contentType(String path) {
    final ext = path.split('.').last.toLowerCase();
    if (['jpg', 'jpeg'].contains(ext)) return 'image/jpeg';
    if (ext == 'png') return 'image/png';
    if (ext == 'pdf') return 'application/pdf';
    return 'application/octet-stream';
  }

  Future<String?> uploadFile(File file, CloudinaryFolder folder) async {
    try {
      final uploadUrl = folder == CloudinaryFolder.certificates
          ? CloudinaryConstants.rawUploadUrl
          : CloudinaryConstants.imageUploadUrl;

      final request = http.MultipartRequest('POST', Uri.parse(uploadUrl));
      request.fields['upload_preset'] = CloudinaryConstants.uploadPreset;
      request.fields['folder'] = _folderName(folder);

      final mimeType = _contentType(file.path);
      request.files.add(await http.MultipartFile.fromPath(
        'file',
        file.path,
        contentType: MediaType.parse(mimeType),
      ));

      final response = await request.send();
      final body = await response.stream.bytesToString();
      final json = jsonDecode(body) as Map<String, dynamic>;

      if (response.statusCode == 200) {
        return json['secure_url'] as String?;
      }
      return null;
    } catch (e) {
      return null;
    }
  }
}
