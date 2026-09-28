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

    # Android Vulkan exposes newer entry points through vkGetInstanceProcAddr; keep the loader path portable across API levels.
    file(READ "${vknn_SOURCE_DIR}/src/backend/vulkan/vk_context.h" VKNN_CTX_H)
    string(REPLACE
        "        PFN_vkCmdPipelineBarrier2KHR cmdPipelineBarrier2 = nullptr;"
        "        PFN_vkCmdPipelineBarrier2KHR cmdPipelineBarrier2 = nullptr;
        PFN_vkGetPhysicalDeviceProperties2 getPhysicalDeviceProperties2 = nullptr;
        PFN_vkGetPhysicalDeviceFeatures2 getPhysicalDeviceFeatures2 = nullptr;
        PFN_vkGetPhysicalDeviceQueueFamilyProperties2 getPhysicalDeviceQueueFamilyProperties2 = nullptr;
        PFN_vkGetPhysicalDeviceMemoryProperties2 getPhysicalDeviceMemoryProperties2 = nullptr;"
        VKNN_CTX_H "${VKNN_CTX_H}")
    file(WRITE "${vknn_SOURCE_DIR}/src/backend/vulkan/vk_context.h" "${VKNN_CTX_H}")

    file(READ "${vknn_SOURCE_DIR}/src/backend/vulkan/vk_context.cpp" VKNN_CTX_CPP)
    string(REPLACE
        "            VK_CHECK(vkCreateInstance(&ci, nullptr, &instance_));"
        "            VK_CHECK(vkCreateInstance(&ci, nullptr, &instance_));
            getPhysicalDeviceProperties2 = reinterpret_cast<PFN_vkGetPhysicalDeviceProperties2>(vkGetInstanceProcAddr(instance_, \"vkGetPhysicalDeviceProperties2\"));
            getPhysicalDeviceFeatures2 = reinterpret_cast<PFN_vkGetPhysicalDeviceFeatures2>(vkGetInstanceProcAddr(instance_, \"vkGetPhysicalDeviceFeatures2\"));
            getPhysicalDeviceQueueFamilyProperties2 = reinterpret_cast<PFN_vkGetPhysicalDeviceQueueFamilyProperties2>(vkGetInstanceProcAddr(instance_, \"vkGetPhysicalDeviceQueueFamilyProperties2\"));
            getPhysicalDeviceMemoryProperties2 = reinterpret_cast<PFN_vkGetPhysicalDeviceMemoryProperties2>(vkGetInstanceProcAddr(instance_, \"vkGetPhysicalDeviceMemoryProperties2\"));
            if (!getPhysicalDeviceProperties2 || !getPhysicalDeviceFeatures2 || !getPhysicalDeviceQueueFamilyProperties2 || !getPhysicalDeviceMemoryProperties2) {
                throw Error(Status::Unsupported, \"required Vulkan 1.1 physical-device entry points are unavailable\");
            }"
        VKNN_CTX_CPP "${VKNN_CTX_CPP}")
    string(REPLACE "vkGetPhysicalDeviceProperties2(phys_, &props2)" "getPhysicalDeviceProperties2(phys_, &props2)" VKNN_CTX_CPP "${VKNN_CTX_CPP}")
    string(REPLACE "vkGetPhysicalDeviceFeatures2(phys_, &feats2)" "getPhysicalDeviceFeatures2(phys_, &feats2)" VKNN_CTX_CPP "${VKNN_CTX_CPP}")
    string(REPLACE "vkGetPhysicalDeviceQueueFamilyProperties2(phys_, &familyCount, nullptr)" "getPhysicalDeviceQueueFamilyProperties2(phys_, &familyCount, nullptr)" VKNN_CTX_CPP "${VKNN_CTX_CPP}")
    string(REPLACE "vkGetPhysicalDeviceQueueFamilyProperties2(phys_, &familyCount, familyProps.data())" "getPhysicalDeviceQueueFamilyProperties2(phys_, &familyCount, familyProps.data())" VKNN_CTX_CPP "${VKNN_CTX_CPP}")
    file(WRITE "${vknn_SOURCE_DIR}/src/backend/vulkan/vk_context.cpp" "${VKNN_CTX_CPP}")

    file(READ "${vknn_SOURCE_DIR}/src/backend/vulkan/vk_buffer.cpp" VKNN_BUFFER_CPP)
    string(REPLACE "vkGetPhysicalDeviceMemoryProperties2(ctx_.physicalDevice(), &props)" "ctx_.getPhysicalDeviceMemoryProperties2(ctx_.physicalDevice(), &props)" VKNN_BUFFER_CPP "${VKNN_BUFFER_CPP}")
    file(WRITE "${vknn_SOURCE_DIR}/src/backend/vulkan/vk_buffer.cpp" "${VKNN_BUFFER_CPP}")

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
