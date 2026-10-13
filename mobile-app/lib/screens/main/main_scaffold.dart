import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/theme/app_theme.dart';
import '../../providers/student_provider.dart';
import '../home/home_screen.dart';
import '../profile/profile_screen.dart';
import '../intelligence/intelligence_screen.dart';
import '../documents/documents_screen.dart';
import '../predict/predict_screen.dart';

class MainScaffold extends StatefulWidget {
  const MainScaffold({super.key});

  @override
  State<MainScaffold> createState() => _MainScaffoldState();
}

class _MainScaffoldState extends State<MainScaffold> {
  int _currentIndex = 0;

  final List<Widget> _screens = const [
    HomeScreen(),
    IntelligenceScreen(),
    PredictScreen(),
    DocumentsScreen(),
    ProfileScreen(),
  ];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) context.read<StudentProvider>().fetchProfile();
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: IndexedStack(index: _currentIndex, children: _screens),
      bottomNavigationBar: _buildBottomNav(),
    );
  }

  Widget _buildBottomNav() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 20),
      child: Container(
        height: 72,
        decoration: BoxDecoration(
          color: AppTheme.cardWhite,
          borderRadius: BorderRadius.circular(22),
          border: Border.all(color: AppTheme.borderBlack, width: 3),
          boxShadow: AppTheme.cardShadow,
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceAround,
          children: [
            _navItem(0, Icons.home_rounded, 'Home'),
            _navItem(1, Icons.mic_rounded, 'AI Voice'),
            _navItem(2, Icons.auto_awesome_rounded, 'Predict'),
            _navItem(3, Icons.folder_shared_rounded, 'Docs'),
            _navItem(4, Icons.person_rounded, 'Profile'),
          ],
        ),
      ),
    );
  }

  Widget _navItem(int index, IconData icon, String label) {
    final isActive = _currentIndex == index;
    return GestureDetector(
      onTap: () => setState(() => _currentIndex = index),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        curve: Curves.easeOut,
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
        decoration: BoxDecoration(
          color: isActive ? AppTheme.lavender : Colors.transparent,
          borderRadius: BorderRadius.circular(14),
          border: isActive ? Border.all(color: AppTheme.borderBlack, width: 2) : null,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 24, color: AppTheme.borderBlack),
            const SizedBox(height: 2),
            Text(
              label,
              style: const TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.w700,
                color: AppTheme.borderBlack,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
