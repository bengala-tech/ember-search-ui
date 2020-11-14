import { helper } from "@ember/component/helper";

export const mapContextToProps = (desiredProps = []) => {
  return (context) => {
    let mappedProps = {};
    desiredProps.forEach((prop) => {
      if (context.hasOwnProperty(prop)) {
        mappedProps[prop] = context[prop];
      }
    });
    return mappedProps;
  };
};

export default helper(function (desiredProps /*, hash*/) {
  return mapContextToProps(desiredProps);
});
