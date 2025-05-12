docker run --rm -v "${PWD}:/local" openapitools/openapi-generator-cli generate \
    -i https://api.prisma.io/doc \
    -g typescript-axios \
    --skip-validate-spec \
    -o /local/src
