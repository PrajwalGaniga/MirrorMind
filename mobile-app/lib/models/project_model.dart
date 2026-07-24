class ProjectModel {
  final String id;
  final String title;
  final String description;
  final String? githubUrl;
  final String? liveDemoUrl;
  final List<String> techStack;
  final String? thumbnailUrl;
  final String? certificateUrl;

  ProjectModel({
    required this.id,
    required this.title,
    required this.description,
    this.githubUrl,
    this.liveDemoUrl,
    required this.techStack,
    this.thumbnailUrl,
    this.certificateUrl,
  });

  factory ProjectModel.fromJson(Map<String, dynamic> json) => ProjectModel(
        id: json['id'] as String,
        title: json['title'] as String,
        description: json['description'] as String,
        githubUrl: json['github_url'] as String?,
        liveDemoUrl: json['live_demo_url'] as String?,
        techStack: (json['tech_stack'] as List?)?.map((e) => e.toString()).toList() ?? [],
        thumbnailUrl: json['thumbnail_url'] as String?,
        certificateUrl: json['certificate_url'] as String?,
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'title': title,
        'description': description,
        'github_url': githubUrl,
        'live_demo_url': liveDemoUrl,
        'tech_stack': techStack,
        'thumbnail_url': thumbnailUrl,
        'certificate_url': certificateUrl,
      };
}
