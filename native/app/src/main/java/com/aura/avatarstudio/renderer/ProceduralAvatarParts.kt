package com.aura.avatarstudio.renderer

import ai.grokgirls.studio.NativeAvatarDefinition

import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.sin
import kotlin.math.sqrt

/**
 * Runtime accessory/customization layer transplanted from the 3DDD procedural-avatar lineage.
 * It deliberately augments the existing GLB instead of replacing the working HD renderer.
 */
object ProceduralAvatarParts {
    data class Bounds(
        val minX: Float, val minY: Float, val minZ: Float,
        val maxX: Float, val maxY: Float, val maxZ: Float
    ) {
        val height get() = (maxY - minY).coerceAtLeast(0.1f)
        val radius get() = height * 0.075f
        val headY get() = maxY - radius * 1.35f
        val neckY get() = maxY - radius * 2.6f
        val shoulderY get() = maxY - height * 0.22f
        val shoulderHalf get() = ((maxX - minX) * 0.5f).coerceAtLeast(0.05f) * 0.72f
        val torsoY get() = minY + height * 0.62f
        val torsoHalf get() = ((maxX - minX) * 0.5f).coerceAtLeast(0.05f) * 0.52f
        val hipY get() = minY + height * 0.47f
    }

    fun apply(avatar: HdAvatar, definition: NativeAvatarDefinition) {
        val b = bounds(avatar)
        val hair = definition.hair.lowercase()
        val outfit = definition.outfit.lowercase()
        val accessory = definition.accessory.lowercase()

        // Hair is geometry, not just a label.
        when {
            hair.contains("long") || hair.contains("braid") -> addHair(avatar, b, long = true)
            hair.contains("pony") || hair.contains("tail") -> addHair(avatar, b, long = false, pony = true)
            hair.contains("curly") || hair.contains("wave") -> addCurlyHair(avatar, b)
            hair.contains("mohawk") -> addMohawk(avatar, b)
            !hair.contains("bald") && !hair.contains("shaved") -> addHair(avatar, b, long = false)
        }

        // 3DDD's crown/accessory concept is now a real mesh in this renderer.
        when {
            accessory.contains("crown") || accessory.contains("tiara") ->
                addCrown(avatar, b)
            accessory.contains("glass") -> addGlasses(avatar, b)
            accessory.contains("visor") -> addVisor(avatar, b)
            accessory.contains("earring") -> addEarrings(avatar, b)
            accessory.contains("collar") || accessory.contains("choker") -> addCollar(avatar, b)
        }

        when {
            outfit.contains("armour") || outfit.contains("armor") ->
                addTorsoShell(avatar, b, 1.20f, "#53627A", 0.85f)
            outfit.contains("dress") || outfit.contains("tunic") ->
                addDress(avatar, b)
            outfit.contains("jacket") ->
                addTorsoShell(avatar, b, 1.12f, "#26344F", 0.25f)
            outfit.contains("body") || outfit.contains("suit") || outfit.contains("casual") ->
                addTorsoShell(avatar, b, 1.02f, "#20283A", 0.10f)
        }

        val aug = definition.augmentations.lowercase()
        when {
            aug.contains("shoulder") -> addShoulderPlates(avatar, b)
            aug.contains("head") || aug.contains("implant") -> addHeadImplants(avatar, b)
            aug.contains("spine") -> addSpine(avatar, b)
            aug.contains("arm") -> addArmCasings(avatar, b)
        }

        val tattoo = definition.tattoos.lowercase()
        if (tattoo != "none") addTattooBand(avatar, b, tattoo)
    }

    private fun bounds(a: HdAvatar): Bounds {
        var minX = Float.MAX_VALUE; var minY = Float.MAX_VALUE; var minZ = Float.MAX_VALUE
        var maxX = -Float.MAX_VALUE; var maxY = -Float.MAX_VALUE; var maxZ = -Float.MAX_VALUE
        for (m in a.meshes) for (i in m.positions.indices step 3) {
            minX = minOf(minX, m.positions[i]); maxX = maxOf(maxX, m.positions[i])
            minY = minOf(minY, m.positions[i + 1]); maxY = maxOf(maxY, m.positions[i + 1])
            minZ = minOf(minZ, m.positions[i + 2]); maxZ = maxOf(maxZ, m.positions[i + 2])
        }
        return Bounds(minX, minY, minZ, maxX, maxY, maxZ)
    }

    private fun addCrown(a: HdAvatar, b: Bounds) {
        val r = b.radius
        torus(a, 0f, b.headY + r * 0.78f, 0f, r * 0.72f, r * 0.055f, "#E8C65A", 0.9f, 0.18f)
        for (i in 0 until 6) {
            val ang = 2.0 * PI * i / 6.0
            box(a,
                (cos(ang) * r * 0.72f).toFloat(), b.headY + r * 0.94f, (sin(ang) * r * 0.72f).toFloat(),
                r * 0.055f, r * 0.18f, r * 0.055f, "#E8C65A", 0.9f, 0.18f)
        }
    }

    private fun addGlasses(a: HdAvatar, b: Bounds) {
        val r = b.radius
        for (side in intArrayOf(-1, 1))
            torus(a, side * r * 0.38f, b.headY + r * 0.12f, r * 0.92f, r * 0.24f, r * 0.035f, "#1B2230", 0.8f, 0.16f)
        box(a, 0f, b.headY + r * 0.12f, r * 0.92f, r * 0.16f, r * 0.025f, r * 0.025f, "#1B2230", 0.8f, 0.16f)
    }

    private fun addVisor(a: HdAvatar, b: Bounds) {
        val r=b.radius
        ellipsoid(a,0f,b.headY+r*0.05f,r*0.1f,r*1.02f,r*0.34f,r*0.08f,"#42D9FF",0.7f,0.12f)
    }

    private fun addEarrings(a: HdAvatar,b:Bounds) {
        val r=b.radius
        for(side in intArrayOf(-1,1))
            ellipsoid(a,side*r*.95f,b.headY-r*.05f,0f,r*.09f,r*.14f,r*.09f,"#E8C65A",.9f,.2f)
    }

    private fun addCollar(a: HdAvatar,b:Bounds) =
        torus(a,0f,b.neckY+b.radius*.35f,0f,b.radius*.52f,b.radius*.09f,"#3E4D70",.75f,.2f)

    private fun addHair(a:HdAvatar,b:Bounds,long:Boolean,pony:Boolean=false) {
        val r=b.radius*1.06f
        ellipsoid(a,0f,b.headY,0f,r,r*1.08f,r*1.05f,"#182033",.15f,.42f)
        if(long) ellipsoid(a,0f,b.neckY-r*.8f,-r*.28f,r*1.1f,r*1.45f,r*.6f,"#182033",.15f,.42f)
        if(pony) capsule(a,0f,b.headY+r*.3f,-r*.72f,0f,b.headY-r*2.3f,-r*1.45f,r*.32f,"#182033",.15f,.42f)
    }

    private fun addCurlyHair(a:HdAvatar,b:Bounds) {
        val r=b.radius*1.08f
        ellipsoid(a,0f,b.headY,0f,r,r*1.08f,r*1.05f,"#241A25",.1f,.5f)
        for(i in 0 until 10){ val x=cos(PI*i/9.0)*r*1.05; val y=b.headY+sin(PI*i/9.0)*r*.9
            ellipsoid(a,x.toFloat(),y.toFloat(),0f,r*.30f,r*.30f,r*.30f,"#241A25",.1f,.5f) }
    }

    private fun addMohawk(a:HdAvatar,b:Bounds) =
        box(a,0f,b.headY+b.radius*.72f,0f,b.radius*.16f,b.radius*.62f,b.radius*1.15f,"#522A60",.15f,.4f)

    private fun addTorsoShell(a:HdAvatar,b:Bounds,scale:Float,color:String,metal:Float) =
        ellipsoid(a,0f,b.torsoY,0f,b.torsoHalf*scale,(b.shoulderY-b.hipY)*.62f,
            ((b.maxZ-b.minZ)*.5f)*.78f*scale,color,metal,.5f)

    private fun addDress(a:HdAvatar,b:Bounds) {
        addTorsoShell(a,b,1.08f,"#343A55",.12f)
        cone(a,0f,b.hipY,0f,b.torsoHalf*1.05f,b.torsoHalf*1.7f,b.height*.22f,"#343A55",.12f,.58f)
    }

    private fun addShoulderPlates(a:HdAvatar,b:Bounds) {
        for(side in intArrayOf(-1,1))
            ellipsoid(a,side*b.shoulderHalf,b.shoulderY+b.radius*.15f,0f,b.shoulderHalf*.42f,b.radius*.55f,((b.maxZ-b.minZ)*.5f)*.75f,"#53627A",1f,.25f)
    }

    private fun addHeadImplants(a:HdAvatar,b:Bounds) {
        for(side in intArrayOf(-1,1))
            box(a,side*b.radius*.92f,b.headY+b.radius*.22f,0f,b.radius*.06f,b.radius*.16f,b.radius*.26f,"#42D9FF",1f,.2f)
    }

    private fun addSpine(a:HdAvatar,b:Bounds) {
        var y=b.shoulderY-b.radius*.3f
        while(y>b.hipY){box(a,0f,y,-((b.maxZ-b.minZ)*.5f)*.78f,b.radius*.22f,b.radius*.10f,b.radius*.10f,"#42D9FF",1f,.22f);y-=b.radius*.42f}
    }

    private fun addArmCasings(a:HdAvatar,b:Bounds) {
        for(side in intArrayOf(-1,1))
            capsule(a,side*b.shoulderHalf*.95f,b.shoulderY,0f,side*b.shoulderHalf*1.18f,b.hipY+b.radius*.4f,0f,b.radius*.30f,"#46526B",.9f,.3f)
    }

    private fun addTattooBand(a:HdAvatar,b:Bounds,id:String) {
        val z=((b.maxZ-b.minZ)*.5f)*.82f
        val color=if(id.contains("circuit")) "#42D9FF" else "#7A4C88"
        box(a,0f,b.torsoY,z,b.torsoHalf*.72f,b.radius*.035f,b.radius*.03f,color,.15f,.35f)
    }

    private fun mesh(a:HdAvatar,p:FloatArray,i:IntArray,color:String,metal:Float,rough:Float) {
        val n=MeshGeometry.generateNormals(p,i)
        val uv=FloatArray((p.size/3)*2)
        val t=MeshGeometry.generateTangents(p,n,uv,i)
        a.meshes += GpuMesh(p,n,t,uv,null,null,i,HdPbrMaterial(baseColor=hex(color),metallic=metal,roughness=rough),emptyList())
    }

    private fun hex(s:String):FloatArray{
        val x=s.removePrefix("#").toLong(16)
        return floatArrayOf(((x shr 16) and 255)/255f,((x shr 8) and 255)/255f,(x and 255)/255f,1f)
    }

    private fun box(a:HdAvatar,cx:Float,cy:Float,cz:Float,hx:Float,hy:Float,hz:Float,color:String,metal:Float,rough:Float){
        val p=floatArrayOf(
            cx-hx,cy-hy,cz-hz,cx+hx,cy-hy,cz-hz,cx+hx,cy+hy,cz-hz,cx-hx,cy+hy,cz-hz,
            cx-hx,cy-hy,cz+hz,cx+hx,cy-hy,cz+hz,cx+hx,cy+hy,cz+hz,cx-hx,cy+hy,cz+hz)
        val i=intArrayOf(0,1,2,0,2,3,4,6,5,4,7,6,0,4,5,0,5,1,3,2,6,3,6,7,1,5,6,1,6,2,0,3,7,0,7,4)
        mesh(a,p,i,color,metal,rough)
    }

    private fun ellipsoid(a:HdAvatar,cx:Float,cy:Float,cz:Float,rx:Float,ry:Float,rz:Float,color:String,metal:Float,rough:Float,seg:Int=20,rings:Int=12){
        val p=FloatArray((rings+1)*(seg+1)*3); var k=0
        for(j in 0..rings){val v=PI*j/rings;val sv=sin(v);val cv=cos(v)
            for(i in 0..seg){val u=2*PI*i/seg;p[k++]=cx+(cos(u)*sv*rx).toFloat();p[k++]=cy+(cv*ry).toFloat();p[k++]=cz+(sin(u)*sv*rz).toFloat()}}
        val idx=ArrayList<Int>()
        for(j in 0 until rings)for(i in 0 until seg){val a0=j*(seg+1)+i;val b0=a0+seg+1;idx.add(a0);idx.add(b0);idx.add(a0+1);idx.add(a0+1);idx.add(b0);idx.add(b0+1)}
        mesh(a,p,idx.toIntArray(),color,metal,rough)
    }

    private fun torus(a:HdAvatar,cx:Float,cy:Float,cz:Float,major:Float,minor:Float,color:String,metal:Float,rough:Float,seg:Int=24,rings:Int=8){
        val p=FloatArray(seg*rings*3);var k=0
        for(i in 0 until seg){val u=2*PI*i/seg
            for(j in 0 until rings){val v=2*PI*j/rings;val r=major+minor*cos(v);p[k++]=(cx+(r*cos(u))).toFloat();p[k++]=(cy+(minor*sin(v))).toFloat();p[k++]=(cz+(r*sin(u))).toFloat()}}
        val idx=ArrayList<Int>()
        for(i in 0 until seg)for(j in 0 until rings){val a0=i*rings+j;val b0=((i+1)%seg)*rings+j;val an=i*rings+(j+1)%rings;val bn=((i+1)%seg)*rings+(j+1)%rings;idx.add(a0);idx.add(b0);idx.add(an);idx.add(an);idx.add(b0);idx.add(bn)}
        mesh(a,p,idx.toIntArray(),color,metal,rough)
    }

    private fun capsule(a:HdAvatar,x0:Float,y0:Float,z0:Float,x1:Float,y1:Float,z1:Float,r:Float,color:String,metal:Float,rough:Float){
        val steps=12; val p=FloatArray((steps+1)*2*3); var k=0
        for(i in 0..steps){val t=i.toFloat()/steps;val x=x0+(x1-x0)*t;val y=y0+(y1-y0)*t;val z=z0+(z1-z0)*t
            p[k++]=x-r;p[k++]=y;p[k++]=z;p[k++]=x+r;p[k++]=y;p[k++]=z}
        val idx=ArrayList<Int>();for(i in 0 until steps){val q=i*2;idx.add(q);idx.add(q+1);idx.add(q+2);idx.add(q+1);idx.add(q+3);idx.add(q+2)}
        mesh(a,p,idx.toIntArray(),color,metal,rough)
    }

    private fun cone(a:HdAvatar,cx:Float,cy:Float,cz:Float,r0:Float,r1:Float,h:Float,color:String,metal:Float,rough:Float,seg:Int=24){
        val p=FloatArray((seg*2)*3);var k=0
        for(j in 0..1){val y=cy+j*h;val r=if(j==0)r0 else r1;for(i in 0 until seg){val u=2*PI*i/seg;p[k++]=(cx+cos(u)*r).toFloat();p[k++]=y;p[k++]=(cz+sin(u)*r).toFloat()}}
        val idx=ArrayList<Int>();for(i in 0 until seg){val n=(i+1)%seg;idx.add(i);idx.add(seg+i);idx.add(n);idx.add(n);idx.add(seg+i);idx.add(seg+n)}
        mesh(a,p,idx.toIntArray(),color,metal,rough)
    }
}
