package ai.grokgirls.studio.ui

import androidx.compose.animation.*
import androidx.compose.animation.core.tween
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavHostController
import androidx.navigation.compose.*
import ai.grokgirls.studio.data.repo.StudioViewModel
import ai.grokgirls.studio.ui.components.AuroraBackground
import ai.grokgirls.studio.ui.nav.Dest
import ai.grokgirls.studio.ui.screens.chat.ChatScreen
import ai.grokgirls.studio.ui.screens.gallery.GalleryScreen
import ai.grokgirls.studio.ui.screens.premium.PremiumScreen
import ai.grokgirls.studio.ui.screens.presets.PresetsScreen
import ai.grokgirls.studio.ui.screens.settings.SettingsScreen
import ai.grokgirls.studio.ui.screens.stats.StatsScreen
import ai.grokgirls.studio.ui.screens.story.StoryScreen
import ai.grokgirls.studio.ui.screens.studio.StudioScreen
import ai.grokgirls.studio.ui.screens.video.VideoScreen

@Composable
fun AppShell(vm: StudioViewModel = viewModel()) {
    val nav = rememberNavController()
    val snackbar = remember { SnackbarHostState() }
    val toast by vm.toast.collectAsState()

    LaunchedEffect(toast) {
        toast?.let {
            snackbar.showSnackbar(it)
            vm.dismissToast()
        }
    }

    val entry by nav.currentBackStackEntryAsState()
    val route = entry?.destination?.route
    val personas by vm.repo.personas.collectAsState()
    val activeId by vm.repo.activeId.collectAsState()
    val active = personas.first { it.id == activeId }
    val wide = LocalConfiguration.current.screenWidthDp >= 600

    Box(Modifier.fillMaxSize()) {
        AuroraBackground(Color(active.scene.accent))

        Row(Modifier.fillMaxSize()) {
            if (wide) {
                NavigationRail(
                    containerColor = MaterialTheme.colorScheme.surfaceContainerLow.copy(alpha = 0.9f),
                    header = {
                        Spacer(Modifier.height(12.dp))
                        FloatingActionButton(
                            onClick = { nav.go(Dest.VIDEO) },
                            containerColor = MaterialTheme.colorScheme.primary,
                        ) { Icon(Icons.Rounded.Movie, "Video studio") }
                    },
                ) {
                    Spacer(Modifier.height(16.dp))
                    Dest.entries.forEach { d ->
                        NavigationRailItem(
                            selected = route == d.route,
                            onClick = { nav.go(d) },
                            icon = { Icon(d.icon, d.label) },
                            label = { Text(d.label, style = MaterialTheme.typography.labelSmall) },
                        )
                    }
                }
            }

            Scaffold(
                containerColor = Color.Transparent,
                snackbarHost = { SnackbarHost(snackbar) },
                bottomBar = {
                    if (!wide) {
                        NavigationBar(
                            containerColor = MaterialTheme.colorScheme.surfaceContainer.copy(alpha = 0.95f),
                            tonalElevation = 0.dp,
                        ) {
                            Dest.bar.forEach { d ->
                                NavigationBarItem(
                                    selected = route == d.route,
                                    onClick = { nav.go(d) },
                                    icon = { Icon(d.icon, d.label) },
                                    label = { Text(d.label, style = MaterialTheme.typography.labelSmall) },
                                    colors = NavigationBarItemDefaults.colors(
                                        selectedIconColor = MaterialTheme.colorScheme.primary,
                                        selectedTextColor = MaterialTheme.colorScheme.primary,
                                        indicatorColor = MaterialTheme.colorScheme.primary.copy(alpha = 0.16f),
                                    ),
                                )
                            }
                        }
                    }
                },
            ) { pad ->
                NavHost(
                    nav, Dest.STUDIO.route,
                    Modifier.padding(pad),
                    enterTransition = { fadeIn(tween(220)) + slideInVertically(tween(260)) { it / 22 } },
                    exitTransition = { fadeOut(tween(160)) },
                ) {
                    composable(Dest.STUDIO.route) { StudioScreen(vm, nav) }
                    composable(Dest.PRESETS.route) { PresetsScreen(vm, nav) }
                    composable(Dest.CHAT.route) { ChatScreen(vm) }
                    composable(Dest.STORY.route) { StoryScreen(vm) }
                    composable(Dest.GALLERY.route) { GalleryScreen(vm) }
                    composable(Dest.VIDEO.route) { VideoScreen(vm) }
                    composable(Dest.STATS.route) { StatsScreen(vm) }
                    composable(Dest.SETTINGS.route) { SettingsScreen(vm) }
                    composable(Dest.PREMIUM.route) { PremiumScreen() }
                }
            }
        }
    }
}

private fun NavHostController.go(d: Dest) {
    navigate(d.route) {
        popUpTo(graph.startDestinationId) { saveState = true }
        launchSingleTop = true
        restoreState = true
    }
}
