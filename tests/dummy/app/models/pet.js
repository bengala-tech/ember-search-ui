import Model, { attr } from '@ember-data/model';

export default class PetModel extends Model {
	@attr('string') name;
	@attr('number') age;
}
