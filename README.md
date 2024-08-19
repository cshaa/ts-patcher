# tsc-patcher
Patch TypeScript to allow for higher type instantiation depth.

## Prerequisites
Install [Bun](https://bun.sh/).

## Example usage
```sh
./tspatcher.ts fetch
./tspatcher.ts patch --package-name=@my-foo-scope/typescript --type-depth=1000 --package-make-public
./tspatcher.ts build
./tspatcher.ts publish --otp=123456
```

