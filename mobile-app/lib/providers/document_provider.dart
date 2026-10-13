import 'dart:io';
import 'package:flutter/material.dart';
import 'package:dio/dio.dart';
import 'package:http_parser/http_parser.dart';
import '../core/constants/api.dart';
import '../core/services/api_service.dart';
import '../models/document_model.dart';

class DocumentProvider extends ChangeNotifier {
  final ApiService _api = ApiService();

  List<DocumentModel> _documents = [];
  bool _isLoading = false;
  bool _isUploading = false;
  String? _error;
  String? _success;

  List<DocumentModel> get documents => _documents;
  bool get isLoading => _isLoading;
  bool get isUploading => _isUploading;
  String? get error => _error;
  String? get success => _success;

  void clearMessages() {
    _error = null;
    _success = null;
    notifyListeners();
  }

  Future<void> fetchDocuments() async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final res = await _api.get(ApiConstants.documents);
      if (res.statusCode == 200 && res.data is List) {
        _documents = (res.data as List)
            .map((item) => DocumentModel.fromJson(item as Map<String, dynamic>))
            .toList();
      }
    } on DioException catch (e) {
      _error = e.response?.data?['detail'] ?? 'Failed to load documents.';
    } catch (e) {
      _error = 'An unexpected error occurred: $e';
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<bool> uploadDocument(File file, String category) async {
    _isUploading = true;
    _error = null;
    _success = null;
    notifyListeners();

    try {
      final filename = file.path.split(Platform.pathSeparator).last;
      final formData = FormData.fromMap({
        'category': category,
        'file': await MultipartFile.fromFile(
          file.path,
          filename: filename,
          contentType: MediaType('application', 'pdf'),
        ),
      });

      final res = await _api.post(
        ApiConstants.documents,
        data: formData,
      );

      if (res.statusCode == 200 || res.statusCode == 201) {
        _success = 'Document uploaded successfully!';
        await fetchDocuments();
        return true;
      } else {
        _error = 'Upload failed. Status: ${res.statusCode}';
        return false;
      }
    } on DioException catch (e) {
      _error = e.response?.data?['detail'] ?? 'Failed to upload document.';
      return false;
    } catch (e) {
      _error = 'Upload error: $e';
      return false;
    } finally {
      _isUploading = false;
      notifyListeners();
    }
  }

  Future<bool> processDocument(String documentId) async {
    _error = null;
    notifyListeners();

    try {
      final res = await _api.post(ApiConstants.documentProcess(documentId));
      if (res.statusCode == 200) {
        _success = 'Text extracted and chunked successfully!';
        await fetchDocuments();
        return true;
      }
      return false;
    } on DioException catch (e) {
      _error = e.response?.data?['detail'] ?? 'Document processing failed.';
      await fetchDocuments();
      return false;
    } catch (e) {
      _error = 'Error processing document: $e';
      return false;
    }
  }

  Future<bool> embedDocument(String documentId) async {
    _error = null;
    notifyListeners();

    try {
      final res = await _api.post(ApiConstants.documentEmbed(documentId));
      if (res.statusCode == 200) {
        _success = 'Document embedded into FAISS vector index!';
        await fetchDocuments();
        return true;
      }
      return false;
    } on DioException catch (e) {
      _error = e.response?.data?['detail'] ?? 'Vector embedding failed.';
      await fetchDocuments();
      return false;
    } catch (e) {
      _error = 'Error embedding document: $e';
      return false;
    }
  }

  Future<bool> deleteDocument(String documentId) async {
    _error = null;
    notifyListeners();

    try {
      final res = await _api.delete(ApiConstants.documentDelete(documentId));
      if (res.statusCode == 200) {
        _documents.removeWhere((doc) => doc.id == documentId);
        _success = 'Document deleted successfully!';
        notifyListeners();
        return true;
      }
      return false;
    } on DioException catch (e) {
      _error = e.response?.data?['detail'] ?? 'Failed to delete document.';
      return false;
    } catch (e) {
      _error = 'Error deleting document: $e';
      return false;
    }
  }
}
