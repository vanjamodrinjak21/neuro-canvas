// swift-tools-version: 5.9

import PackageDescription

let package = Package(
    name: "LocalLLMPlugin",
    platforms: [.iOS(.v15)],
    products: [
        .library(name: "LocalLLMPlugin", targets: ["LocalLLMPlugin"])
    ],
    dependencies: [
        .package(url: "https://github.com/nicepkg/llama-cpp-swift", from: "0.3.0")
    ],
    targets: [
        .target(
            name: "LocalLLMPlugin",
            dependencies: [
                .product(name: "llama", package: "llama-cpp-swift")
            ],
            path: "Sources/LocalLLMPlugin"
        )
    ]
)
