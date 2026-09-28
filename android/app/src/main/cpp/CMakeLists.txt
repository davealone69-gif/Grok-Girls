cmake_minimum_required(VERSION 3.22)
project(grok_vknn LANGUAGES C CXX)
# VKNN uses Vulkan; Android Vulkan is available from API 24.
set(ANDROID_PLATFORM android-26 CACHE STRING "Android API level for native Vulkan" FORCE)
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

include(FetchContent)
FetchContent_Declare(
    vknn
    GIT_REPOSITORY https://github.com/katolikov/vknn.git
    GIT_TAG c44cae11aa06b4d748d11ba49c15c4fabc6e5281
    GIT_SHALLOW TRUE
    GIT_SUBMODULES_RECURSE TRUE
)
set(VKNN_BUILD_TESTS OFF CACHE BOOL "" FORCE)
set(VKNN_BUILD_EXAMPLES OFF CACHE BOOL "" FORCE)
set(VKNN_ENABLE_VULKAN ON CACHE BOOL "" FORCE)
set(VKNN_ENABLE_NEON ON CACHE BOOL "" FORCE)
set(VKNN_SANITIZE OFF CACHE BOOL "" FORCE)
FetchContent_GetProperties(vknn)
if(NOT vknn_POPULATED)
    FetchContent_Populate(vknn)
    # VKNN currently uses CMake's LINK_LIBRARY/WHOLE_ARCHIVE generator expression,
    # which was introduced in CMake 3.24. Patch that one expression in the fetched
    # source so the Android SDK's stable CMake 3.22 can still configure it.
    file(READ "${vknn_SOURCE_DIR}/CMakeLists.txt" VKNN_CMAKE)
    string(REPLACE "$<LINK_LIBRARY:WHOLE_ARCHIVE,vknn>" "vknn" VKNN_CMAKE "${VKNN_CMAKE}")
    file(WRITE "${vknn_SOURCE_DIR}/CMakeLists.txt" "${VKNN_CMAKE}")
    add_subdirectory(${vknn_SOURCE_DIR} ${vknn_BINARY_DIR})
endif()

add_library(grok_vknn SHARED
    vknn_jni.cpp
    ${vknn_SOURCE_DIR}/examples/splatting/raster_core.cpp
)
target_include_directories(grok_vknn PRIVATE
    ${vknn_SOURCE_DIR}/examples/splatting
)
find_library(ANDROID_LOG_LIB log REQUIRED)
find_library(ANDROID_LIB android REQUIRED)
find_library(ANDROID_VULKAN_LIB vulkan REQUIRED)

target_link_libraries(grok_vknn PRIVATE
    vknn
    ${ANDROID_LOG_LIB}
    ${ANDROID_LIB}
    ${ANDROID_VULKAN_LIB}
)
target_link_options(grok_vknn PRIVATE
    "-Wl,-z,max-page-size=16384"
    "-Wl,-z,common-page-size=16384"
)
