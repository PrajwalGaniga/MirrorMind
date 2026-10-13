class ApiKeyModel {
  final bool exists;
  final String? keyPrefix;
  final String? createdAt;
  final String? lastUsedAt;
  final String? rawKey;

  ApiKeyModel({
    required this.exists,
    this.keyPrefix,
    this.createdAt,
    this.lastUsedAt,
    this.rawKey,
  });

  factory ApiKeyModel.fromJson(Map<String, dynamic> json) {
    return ApiKeyModel(
      exists: json['exists'] ?? false,
      keyPrefix: json['key_prefix'],
      createdAt: json['created_at'],
      lastUsedAt: json['last_used_at'],
      rawKey: json['raw_key'],
    );
  }
}
