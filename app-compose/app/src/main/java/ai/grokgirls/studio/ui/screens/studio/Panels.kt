package ai.grokgirls.studio.ui.screens.studio

import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Check
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.unit.dp
import ai.grokgirls.studio.data.model.*
import ai.grokgirls.studio.data.repo.StudioViewModel
import ai.grokgirls.studio.ui.components.*

@Composable
fun AppearancePanel(p: Persona, vm: StudioViewModel) = Column {
    SectionHeader("Persona name")
    OutlinedTextField(
        p.name, { n -> vm.repo.update { it.copy(name = n) } },
        Modifier.fillMaxWidth().padding(horizontal = 18.dp),
        shape = MaterialTheme.shapes.small, singleLine = true,
    )
    Spacer(Modifier.height(6.dp))
    OutlinedTextField(
        p.tagline, { t -> vm.repo.update { it.copy(tagline = t) } },
        Modifier.fillMaxWidth().padding(horizontal = 18.dp),
        shape = MaterialTheme.shapes.small, singleLine = true,
        placeholder = { Text("Tagline") },
    )
    SectionHeader("Presentation")
    ChipRow(Presentation.entries.map { it.label }, p.appearance.presentation.label) { l ->
        vm.repo.update { it.copy(appearance = it.appearance.copy(
            presentation = Presentation.entries.first { e -> e.label == l })) }
    }
    SectionHeader("Skin tone")
    SwatchRow(Catalog.skinTones, p.appearance.skinToneIndex) { i ->
        vm.repo.update { it.copy(appearance = it.appearance.copy(skinToneIndex = i)) }
    }
    SectionHeader("Structure")
    LabeledSlider("Age", (p.appearance.age - 18) / 42f, onChange = { v -> vm.repo.update { it.copy(appearance = it.appearance.copy(age = (18 + v * 42).toInt())) } },
        display = { "${(18 + it * 42).toInt()}" })
    LabeledSlider("Head shape", p.appearance.headShape) { v ->
        vm.repo.update { it.copy(appearance = it.appearance.copy(headShape = v)) } }
    LabeledSlider("Skin detail", p.appearance.skinDetail) { v ->
        vm.repo.update { it.copy(appearance = it.appearance.copy(skinDetail = v)) } }
}

@Composable
fun HairPanel(p: Persona, vm: StudioViewModel) = Column {
    SectionHeader("Style")
    ChipRow(Catalog.hairStyles, p.hair.style) { s ->
        vm.repo.update { it.copy(hair = it.hair.copy(style = s)) } }
    SectionHeader("Colour")
    ColorWheel(p.hair.colorArgb) { c -> vm.repo.update { it.copy(hair = it.hair.copy(colorArgb = c)) } }
    SectionHeader("Finish")
    LabeledSlider("Gloss", p.hair.gloss) { v -> vm.repo.update { it.copy(hair = it.hair.copy(gloss = v)) } }
    LabeledSlider("Length", p.hair.length) { v -> vm.repo.update { it.copy(hair = it.hair.copy(length = v)) } }
}

@Composable
fun FacePanel(p: Persona, vm: StudioViewModel) = Column {
    SectionHeader("Eye shape")
    ChipRow(Catalog.eyeShapes, p.face.eyeShape) { s ->
        vm.repo.update { it.copy(face = it.face.copy(eyeShape = s)) } }
    SectionHeader("Eye colour")
    SwatchRow(
        listOf(0xFF3E7C5A, 0xFF5A3A24, 0xFF34D6F0, 0xFF6C7CC4, 0xFF8E7B4A, 0xFF7A4B8E, 0xFF2E2E38, 0xFFB4152B),
        -1,
    ) { i ->
        val opts = listOf(0xFF3E7C5A, 0xFF5A3A24, 0xFF34D6F0, 0xFF6C7CC4, 0xFF8E7B4A, 0xFF7A4B8E, 0xFF2E2E38, 0xFFB4152B)
        vm.repo.update { it.copy(face = it.face.copy(eyeColorArgb = opts[i])) }
    }
    SectionHeader("Eyebrows")
    ChipRow(Catalog.browShapes, p.face.browShape) { s ->
        vm.repo.update { it.copy(face = it.face.copy(browShape = s)) } }
    LabeledSlider("Thickness", p.face.browThickness) { v ->
        vm.repo.update { it.copy(face = it.face.copy(browThickness = v)) } }
    SectionHeader("Makeup")
    ChipRow(Catalog.makeupLooks, p.face.makeup) { s ->
        vm.repo.update { it.copy(face = it.face.copy(makeup = s)) } }
    SectionHeader("Lip colour")
    ColorWheel(p.face.lipColorArgb) { c -> vm.repo.update { it.copy(face = it.face.copy(lipColorArgb = c)) } }
    SectionHeader("Detail")
    LabeledSlider("Freckles", p.face.freckles) { v ->
        vm.repo.update { it.copy(face = it.face.copy(freckles = v)) } }
}

@Composable
fun BodyPanel(p: Persona, vm: StudioViewModel) = Column {
    SectionHeader("Proportions")
    LabeledSlider("Height", p.body.height) { v -> vm.repo.update { it.copy(body = it.body.copy(height = v)) } }
    LabeledSlider("Build", p.body.build) { v -> vm.repo.update { it.copy(body = it.body.copy(build = v)) } }
    SectionHeader("Posture")
    ChipRow(Catalog.postures, p.body.posture) { s ->
        vm.repo.update { it.copy(body = it.body.copy(posture = s)) } }
}

@Composable
fun ClothingPanel(p: Persona, vm: StudioViewModel, adult: Boolean) = Column {
    SectionHeader("Top")
    ChipRow(Catalog.tops, p.outfit.top) { s -> vm.repo.update { it.copy(outfit = it.outfit.copy(top = s)) } }
    SectionHeader("Bottom")
    ChipRow(Catalog.bottoms, p.outfit.bottom) { s -> vm.repo.update { it.copy(outfit = it.outfit.copy(bottom = s)) } }
    SectionHeader("Hosiery")
    ChipRow(Catalog.hosiery, p.outfit.hosiery) { s -> vm.repo.update { it.copy(outfit = it.outfit.copy(hosiery = s)) } }
    SectionHeader("Neckwear")
    ChipRow(Catalog.neckwear, p.outfit.neckwear) { s -> vm.repo.update { it.copy(outfit = it.outfit.copy(neckwear = s)) } }
    SectionHeader("Footwear")
    ChipRow(Catalog.footwear, p.outfit.footwear) { s -> vm.repo.update { it.copy(outfit = it.outfit.copy(footwear = s)) } }
    Spacer(Modifier.height(10.dp))
    GlassPanel(Modifier.fillMaxWidth().padding(horizontal = 18.dp)) {
        Row(Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text("Mature content (18+)", style = MaterialTheme.typography.titleMedium)
                Text("All personas are fictional adults.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            Switch(adult, { vm.repo.setAdult(it) })
        }
    }
}

@Composable
fun ExtrasPanel(p: Persona, vm: StudioViewModel) = Column {
    SectionHeader("Tattoos")
    MultiSelect(Catalog.tattoos, p.tattoos) { s ->
        vm.repo.update { it.copy(tattoos = it.tattoos.toggle(s)) } }
    SectionHeader("Augments")
    MultiSelect(Catalog.augments, p.augments) { s ->
        vm.repo.update { it.copy(augments = it.augments.toggle(s)) } }
    SectionHeader("Accessories")
    MultiSelect(Catalog.accessories, p.accessories) { s ->
        vm.repo.update { it.copy(accessories = it.accessories.toggle(s)) } }
}

@Composable
fun ScenePanel(p: Persona, vm: StudioViewModel) = Column {
    SectionHeader("Scene style")
    LazyRow(
        Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
        contentPadding = PaddingValues(horizontal = 18.dp),
    ) {
        items(SceneStyle.entries.size) { i ->
            val s = SceneStyle.entries[i]
            val sel = s == p.scene
            Column(
                Modifier.width(122.dp).clip(MaterialTheme.shapes.small)
                    .border(
                        if (sel) 2.dp else 1.dp,
                        if (sel) Color(s.accent) else MaterialTheme.colorScheme.outlineVariant,
                        MaterialTheme.shapes.small,
                    )
                    .clickable { vm.repo.update { it.copy(scene = s) } },
            ) {
                Box(Modifier.fillMaxWidth().height(78.dp)) {
                    AssetImage(s.backdropAsset, Modifier.fillMaxSize(), ContentScale.Crop)
                    Box(Modifier.matchParentSize().background(Color(s.accent).copy(alpha = 0.22f)))
                    if (sel) Icon(Icons.Rounded.Check, null,
                        Modifier.align(Alignment.TopEnd).padding(6.dp).size(18.dp), tint = Color.White)
                }
                Text(s.label, Modifier.padding(9.dp),
                    style = MaterialTheme.typography.labelMedium, maxLines = 1)
            }
        }
    }
    Spacer(Modifier.height(14.dp))
    SectionHeader("Prompt style")
    Text(p.scene.promptStyle, Modifier.padding(horizontal = 18.dp),
        style = MaterialTheme.typography.bodyMedium,
        color = MaterialTheme.colorScheme.onSurfaceVariant)
}

@Composable
private fun MultiSelect(options: List<String>, selected: Set<String>, onToggle: (String) -> Unit) {
    LazyRow(
        Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        contentPadding = PaddingValues(horizontal = 18.dp),
    ) {
        items(options.size) { i ->
            val o = options[i]
            FilterChip(
                selected = o in selected,
                onClick = { onToggle(o) },
                label = { Text(o) },
                shape = MaterialTheme.shapes.small,
                leadingIcon = if (o in selected) {
                    { Icon(Icons.Rounded.Check, null, Modifier.size(15.dp)) }
                } else null,
            )
        }
    }
}

private fun Set<String>.toggle(v: String) = if (v in this) this - v else this + v
