class DocumentModel {
  final String id;
  final String filename;
  final String? originalFilename;
  final String category;
  final String fileType;
  final int fileSize;
  final String processingStatus;
  final String? processingError;
  final int? pageCount;
  final int? chunkCount;
  final String? embeddingStatus;
  final String? embeddingError;
  final int? embeddedChunkCount;
  final String? cloudinaryUrl;
  final String uploadedAt;
  final String? processedAt;
  final String? embeddedAt;

  DocumentModel({
    required this.id,
    required this.filename,
    this.originalFilename,
    required this.category,
    required this.fileType,
    required this.fileSize,
    required this.processingStatus,
    this.processingError,
    this.pageCount,
    this.chunkCount,
    this.embeddingStatus,
    this.embeddingError,
    this.embeddedChunkCount,
    this.cloudinaryUrl,
    required this.uploadedAt,
    this.processedAt,
    this.embeddedAt,
  });

  factory DocumentModel.fromJson(Map<String, dynamic> json) {
    return DocumentModel(
      id: json['_id']?.toString() ?? json['id']?.toString() ?? '',
      filename: json['filename'] ?? 'Untitled Document',
      originalFilename: json['original_filename'],
      category: json['category'] ?? 'other',
      fileType: json['file_type'] ?? 'pdf',
      fileSize: json['file_size'] is int ? json['file_size'] : int.tryParse(json['file_size']?.toString() ?? '0') ?? 0,
      processingStatus: json['processing_status'] ?? 'uploaded',
      processingError: json['processing_error'],
      pageCount: json['page_count'] is int ? json['page_count'] : int.tryParse(json['page_count']?.toString() ?? ''),
      chunkCount: json['chunk_count'] is int ? json['chunk_count'] : int.tryParse(json['chunk_count']?.toString() ?? ''),
      embeddingStatus: json['embedding_status'],
      embeddingError: json['embedding_error'],
      embeddedChunkCount: json['embedded_chunk_count'] is int ? json['embedded_chunk_count'] : int.tryParse(json['embedded_chunk_count']?.toString() ?? ''),
      cloudinaryUrl: json['cloudinary_url'],
      uploadedAt: json['uploaded_at'] ?? '',
      processedAt: json['processed_at'],
      embeddedAt: json['embedded_at'],
    );
  }

  bool get isProcessed => processingStatus == 'processed';
  bool get isProcessing => processingStatus == 'processing';
  bool get isFailed => processingStatus == 'failed';

  bool get isEmbedded => embeddingStatus == 'embedded';
  bool get isEmbedding => embeddingStatus == 'embedding';
  bool get isEmbeddingFailed => embeddingStatus == 'failed';

  String get formattedSize {
    if (fileSize < 1024) return '$fileSize B';
    if (fileSize < 1024 * 1024) return '${(fileSize / 1024).toStringAsFixed(1)} KB';
    return '${(fileSize / (1024 * 1024)).toStringAsFixed(1)} MB';
  }
}
