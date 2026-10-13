class SourceCitation {
  final String filename;
  final int pageStart;
  final int pageEnd;
  final String documentId;
  final String chunkId;
  final double? similarity;
  final String? text;

  SourceCitation({
    required this.filename,
    required this.pageStart,
    required this.pageEnd,
    required this.documentId,
    required this.chunkId,
    this.similarity,
    this.text,
  });

  factory SourceCitation.fromJson(Map<String, dynamic> json) {
    return SourceCitation(
      filename: json['filename'] ?? 'Unknown Document',
      pageStart: json['page_start'] is int ? json['page_start'] : int.tryParse(json['page_start']?.toString() ?? '1') ?? 1,
      pageEnd: json['page_end'] is int ? json['page_end'] : int.tryParse(json['page_end']?.toString() ?? '1') ?? 1,
      documentId: json['document_id'] ?? '',
      chunkId: json['chunk_id'] ?? '',
      similarity: json['score'] != null ? (json['score'] as num).toDouble() : null,
      text: json['text'],
    );
  }
}

class IntelligenceMessage {
  final String id;
  final String text;
  final bool isUser;
  final DateTime timestamp;
  final List<SourceCitation> sources;
  final String? provider;
  final String? model;
  final bool isError;

  IntelligenceMessage({
    required this.id,
    required this.text,
    required this.isUser,
    required this.timestamp,
    this.sources = const [],
    this.provider,
    this.model,
    this.isError = false,
  });
}

class IntelligenceResponse {
  final String question;
  final String answer;
  final List<SourceCitation> sources;
  final String provider;
  final String model;
  final int retrievedChunks;
  final int contextChunksUsed;
  final bool contextTruncated;

  IntelligenceResponse({
    required this.question,
    required this.answer,
    required this.sources,
    required this.provider,
    required this.model,
    required this.retrievedChunks,
    required this.contextChunksUsed,
    required this.contextTruncated,
  });

  factory IntelligenceResponse.fromJson(Map<String, dynamic> json) {
    final rawSources = json['sources'] as List<dynamic>? ?? [];
    return IntelligenceResponse(
      question: json['question'] ?? '',
      answer: json['answer'] ?? '',
      sources: rawSources.map((s) => SourceCitation.fromJson(s as Map<String, dynamic>)).toList(),
      provider: json['provider'] ?? 'gemini',

      model: json['model'] ?? '',
      retrievedChunks: json['retrieved_chunks'] ?? 0,
      contextChunksUsed: json['context_chunks_used'] ?? 0,
      contextTruncated: json['context_truncated'] ?? false,
    );
  }
}
