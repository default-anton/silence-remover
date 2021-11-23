ROOT_DIR                  := $(shell dirname $(realpath $(firstword $(MAKEFILE_LIST))))
DAVINCI_INSTALLATION_DIR  = /Library/Application Support/Blackmagic Design/DaVinci Resolve
APP_NAME                  = com.antonkuzmenko.silence_remover
PLUGIN_DIR                = $(DAVINCI_INSTALLATION_DIR)/Workflow Integration Plugins/$(APP_NAME)
WORKFLOW_INTEGRATION_NODE = $(shell find "$(DAVINCI_INSTALLATION_DIR)/Developer" -name 'WorkflowIntegration.node' | head -n 1)

.PHONY: install build

install: build
	@rm -rf "$(PLUGIN_DIR)"
	@mkdir -p "$(PLUGIN_DIR)"
	@cp -R "$(ROOT_DIR)/" "$(PLUGIN_DIR)"
	@cp "$(WORKFLOW_INTEGRATION_NODE)" "$(PLUGIN_DIR)/dist/"

build:
	@rm -rf ./dist
	@npm run build
