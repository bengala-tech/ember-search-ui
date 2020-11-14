import GlimmerComponent from "@glimmer/component";
import { SearchDriver } from "@elastic/search-ui";
import { setComponentTemplate } from "@ember/component";
import { hbs } from "ember-cli-htmlbars";

const defaultA11yMessages = {
  moreFilters: ({ visibleOptionsCount, showingAll }) => {
    let message = showingAll ? "All " : "";
    message += `${visibleOptionsCount} options shown.`;
    return message;
  }
};

const template = hbs`
	{{#if this.driver}}
		{{yield this.driver}}
	{{/if}}
`;

export const setupDriver = (config = {}, driver) => {
	if (typeof FastBoot === 'undefined') {
		const currentDriver = driver || new SearchDriver({
			...config,
			a11yNotificationMessages: {
				...defaultA11yMessages,
				...config.a11yNotificationMessages
			}
		});
		return currentDriver;
	}
}

class SearchProviderComponent extends GlimmerComponent {
	_driver = null;
	_lastSearchQuery = null;
	_lastAutocompleteQuery = null;

	get driver() {
		if(!this._driver) {
      this._driver = setupDriver(this.args.config, this.args.driver);
      this.saveQuery(this.args.config);
  
      return this._driver;
    }
    
    if(this.configChanged(this.args.config, 'searchQuery', '_lastSearchQuery')) {
      this._lastSearchQuery = this.args.config.searchQuery;
      this._driver.setSearchQuery(this.args.config.searchQuery);
    }

    if(this.configChanged(this.args.config, 'autocompleteQuery', '_lastAutocompleteQuery')) {
      this._lastAutocompleteQuery = this.args.config.autocompleteQuery;
      this._driver.setAutocompleteQuery(this.args.config.autocompleteQuery);
    }

    return this._driver;
	}

	configChanged(config = {}, configKey, key) {
		return config?.[configKey] && config[configKey] !== this[key];
	}

	saveQuery({ searchQuery, autocompleteQuery } = {}) {
		this._lastSearchQuery = searchQuery;
		this._lastAutocompleteQuery = autocompleteQuery;
	}

	willDestroy() {
		this.driver && this.driver.tearDown();
	}
	
}

export default setComponentTemplate(
	template,
  SearchProviderComponent
);
