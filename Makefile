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

publish: build
	pnpm publish --access public
