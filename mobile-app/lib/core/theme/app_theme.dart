import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class AppTheme {
  // ── Core Brand Tokens (Nova / Velora Design System) ─────────────────────────
  static const Color primary = Color(0xFF2563EB); // Royal Blue
  static const Color primaryDark = Color(0xFF1D4ED8);
  static const Color primaryLight = Color(0xFFEFF6FF);
  static const Color primaryGlow = Color(0x332563EB);

  static const Color canvas = Color(0xFFF1F5F9);
  static const Color cardWhite = Color(0xFFFFFFFF);
  static const Color cardSubtle = Color(0xFFF8FAFC);
  static const Color borderLight = Color(0xFFE2E8F0);
  static const Color borderMedium = Color(0xFFCBD5E1);

  // Aliased for legacy widgets, now mapped to refined slate border
  static const Color borderBlack = Color(0xFFE2E8F0);

  static const Color textPrimary = Color(0xFF0F172A); // Deep Slate 900
  static const Color textBody = Color(0xFF334155);    // Slate 700
  static const Color textCaption = Color(0xFF64748B); // Slate 500
  static const Color textMuted = Color(0xFF94A3B8);   // Slate 400

  // ── Modern Semantic Accents ────────────────────────────────────────────────
  static const Color emerald = Color(0xFF10B981);
  static const Color emeraldBg = Color(0xFFECFDF5);
  static const Color emeraldText = Color(0xFF065F46);

  static const Color amber = Color(0xFFF59E0B);
  static const Color amberBg = Color(0xFFFFFBEB);
  static const Color amberText = Color(0xFF92400E);

  static const Color rose = Color(0xFFEF4444);
  static const Color roseBg = Color(0xFFFEF2F2);
  static const Color roseText = Color(0xFF991B1B);

  static const Color sky = Color(0xFF0EA5E9);
  static const Color skyBg = Color(0xFFF0F9FF);
  static const Color skyText = Color(0xFF0369A1);

  static const Color purple = Color(0xFF8B5CF6);
  static const Color purpleBg = Color(0xFFF5F3FF);
  static const Color purpleText = Color(0xFF5B21B6);

  // ── Pastel Accents (Clean Modern Tints) ─────────────────────────────────────
  static const Color lavender = Color(0xFFEFF6FF); // Royal Blue Tint
  static const Color mint = Color(0xFFECFDF5);     // Emerald Tint
  static const Color peach = Color(0xFFFFFBEB);    // Amber Tint
  static const Color softRed = Color(0xFFFEF2F2);  // Rose Tint
  static const Color skyBlue = Color(0xFFF0F9FF);  // Sky Tint

  // ── Multi-Layer Soft Elevation Shadows ──────────────────────────────────────
  static List<BoxShadow> cardShadow = [
    BoxShadow(
      color: const Color(0xFF0F172A).withValues(alpha: 0.05),
      offset: const Offset(0, 4),
      blurRadius: 18,
      spreadRadius: 0,
    ),
    BoxShadow(
      color: const Color(0xFF0F172A).withValues(alpha: 0.02),
      offset: const Offset(0, 1),
      blurRadius: 4,
      spreadRadius: 0,
    ),
  ];

  static List<BoxShadow> cardShadowHover = [
    BoxShadow(
      color: const Color(0xFF0F172A).withValues(alpha: 0.08),
      offset: const Offset(0, 8),
      blurRadius: 24,
      spreadRadius: -2,
    ),
    BoxShadow(
      color: const Color(0xFF0F172A).withValues(alpha: 0.03),
      offset: const Offset(0, 2),
      blurRadius: 6,
      spreadRadius: 0,
    ),
  ];

  static List<BoxShadow> cardShadowPressed = [
    BoxShadow(
      color: const Color(0xFF0F172A).withValues(alpha: 0.04),
      offset: const Offset(0, 2),
      blurRadius: 6,
      spreadRadius: 0,
    ),
  ];

  // ── Borders & Radii ────────────────────────────────────────────────────────
  static const Border cardBorder = Border.fromBorderSide(
    BorderSide(color: borderLight, width: 1.0),
  );

  static BorderRadius cardRadius = BorderRadius.circular(20);
  static BorderRadius buttonRadius = BorderRadius.circular(14);
  static BorderRadius tagRadius = BorderRadius.circular(10);
  static BorderRadius pillRadius = BorderRadius.circular(999);

  // ── Typography ─────────────────────────────────────────────────────────────
  static TextStyle heading1(BuildContext context) =>
      GoogleFonts.inter(fontSize: 28, fontWeight: FontWeight.w800, color: textPrimary, height: 1.25);

  static TextStyle heading2(BuildContext context) =>
      GoogleFonts.inter(fontSize: 22, fontWeight: FontWeight.w700, color: textPrimary, letterSpacing: -0.3);

  static TextStyle sectionTitle(BuildContext context) =>
      GoogleFonts.inter(fontSize: 18, fontWeight: FontWeight.w600, color: textPrimary, letterSpacing: -0.2);

  static TextStyle cardTitle(BuildContext context) =>
      GoogleFonts.inter(fontSize: 15, fontWeight: FontWeight.w600, color: textPrimary);

  static TextStyle body(BuildContext context) =>
      GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w400, color: textBody, height: 1.45);

  static TextStyle bodyBold(BuildContext context) =>
      GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w600, color: textPrimary);

  static TextStyle caption(BuildContext context) =>
      GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.w500, color: textCaption);

  static TextStyle metric(BuildContext context) =>
      GoogleFonts.inter(fontSize: 28, fontWeight: FontWeight.w800, color: textPrimary, letterSpacing: -0.5);

  static TextStyle navLabel(BuildContext context) =>
      GoogleFonts.inter(fontSize: 11, fontWeight: FontWeight.w600);

  // ── Theme Data ─────────────────────────────────────────────────────────────
  static ThemeData get theme => ThemeData(
        useMaterial3: true,
        scaffoldBackgroundColor: canvas,
        colorScheme: const ColorScheme.light(
          primary: primary,
          secondary: emerald,
          surface: cardWhite,
          onPrimary: Colors.white,
          onSurface: textPrimary,
          outline: borderLight,
        ),
        appBarTheme: AppBarTheme(
          backgroundColor: canvas,
          elevation: 0,
          scrolledUnderElevation: 0,
          centerTitle: false,
          titleTextStyle: GoogleFonts.inter(
            fontSize: 20,
            fontWeight: FontWeight.w700,
            color: textPrimary,
            letterSpacing: -0.3,
          ),
          iconTheme: const IconThemeData(color: textPrimary),
        ),
        elevatedButtonTheme: ElevatedButtonThemeData(
          style: ElevatedButton.styleFrom(
            backgroundColor: primary,
            foregroundColor: Colors.white,
            minimumSize: const Size(double.infinity, 50),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(14),
            ),
            elevation: 0,
            textStyle: GoogleFonts.inter(fontSize: 15, fontWeight: FontWeight.w600),
          ),
        ),
        outlinedButtonTheme: OutlinedButtonThemeData(
          style: OutlinedButton.styleFrom(
            foregroundColor: textPrimary,
            minimumSize: const Size(double.infinity, 50),
            side: const BorderSide(color: borderMedium, width: 1.0),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
            textStyle: GoogleFonts.inter(fontSize: 15, fontWeight: FontWeight.w600),
          ),
        ),
        inputDecorationTheme: InputDecorationTheme(
          filled: true,
          fillColor: cardWhite,
          contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(14),
            borderSide: const BorderSide(color: borderMedium, width: 1.0),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(14),
            borderSide: const BorderSide(color: borderMedium, width: 1.0),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(14),
            borderSide: const BorderSide(color: primary, width: 1.8),
          ),
          errorBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(14),
            borderSide: const BorderSide(color: rose, width: 1.2),
          ),
          focusedErrorBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(14),
            borderSide: const BorderSide(color: rose, width: 1.8),
          ),
          hintStyle: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w400, color: textMuted),
          labelStyle: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w500, color: textCaption),
        ),
        chipTheme: ChipThemeData(
          backgroundColor: cardWhite,
          selectedColor: primaryLight,
          side: const BorderSide(color: borderLight, width: 1.0),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          labelStyle: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.w600, color: textPrimary),
        ),
      );
}
