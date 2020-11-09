import Controller from '@ember/controller';
import { inject as service } from '@ember/service';

export default class IndexController extends Controller {
  @service store;

  init() {
    super.init(...arguments);
    this.config = {
      onSearch: async (requestState, queryConfig) => {
				try {
					const pets = await this.store.findAll('pet');
					let results = pets;
				
					if(requestState.sortDirection !== "") {
						results = pets.toArray().reverse();
					}
	
					return {
						results,
						totalResults: results.length,
					};
				} catch(e) {
					console.log(e)
				}
      
      },
      onAutocomplete: async (requestState, queryConfig) => {
				try {
					const pets = await this.store.findAll('pet');
					let results = pets;

					console.log(requestState.sortDirection)
					
					if(requestState.sortDirection !== "") {
						results = pets.toArray().reverse();
					}
	
					return {
						autocompletedResults: results,
						totalResults: 0,
					};
				} catch(e) {
					console.log(e)
				}
      
      },
    };
  }
}
