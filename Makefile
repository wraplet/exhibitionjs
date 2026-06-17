.ONESHELL:
.PHONY: $(MAKECMDGOALS)
SHELL = /bin/bash

MAKEFILE_DIR := $(shell dirname $(abspath $(lastword $(MAKEFILE_LIST))))

lint-fix:
	pnpm run lint:fix

lint:
	pnpm run lint

tests: build
	pnpm run tests

cleanup-dist:
	rm -rf ${MAKEFILE_DIR}/dist

build: cleanup-dist
	pnpm run build

build-dev: cleanup-dist
	pnpm run dev:build

publish: required-TAG build
	pnpm publish --access public --tag "${TAG}"

required-%:
	@if [ "${${*}}" = "" ]; then
		echo "Environment variable $* is required";
		exit 1;
	fi

# This is an empty target just to indicate the optional dependencies of other targets.
optional-%:
	@: