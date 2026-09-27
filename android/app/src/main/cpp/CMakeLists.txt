cmake_minimum_required(VERSION 3.24)
project(grok_vknn LANGUAGES C CXX)
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
FetchContent_MakeAvailable(vknn)

add_library(grok_vknn SHARED
    vknn_jni.cpp
    ${vknn_SOURCE_DIR}/examples/splatting/raster_core.cpp
)
target_include_directories(grok_vknn PRIVATE
    ${vknn_SOURCE_DIR}/examples/splatting
)
target_link_libraries(grok_vknn PRIVATE
    "$<LINK_LIBRARY:WHOLE_ARCHIVE,vknn>"
    log android vulkan
)
target_link_options(grok_vknn PRIVATE
    "-Wl,-z,max-page-size=16384"
    "-Wl,-z,common-page-size=16384"
)
