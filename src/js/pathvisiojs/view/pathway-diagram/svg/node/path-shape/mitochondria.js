pathvisiojs.view.pathwayDiagram.svg.node.pathShape.mitochondria = function(){
  'use strict';

  function getAttributes(nodeWidth, nodeHeight, borderWidth) {
      var attributes = [
        {
          name:'d',
          scale:'true', //adds transform and stroke-width attrs to g container
          path: 'm0,50c0,-27.62431 22.37569,-50 50,-50c27.62431,0 50,22.37569 50,50c0,27.62431 -22.37569,50 -50,50c-27.62431,0 -50,-22.37569 -50,-50z'
        },
	{
	  name:'d',
	  path: 'm14.894899,26.347357c4.363817,-0.741571 3.827518,17.036169 8.182638,16.183825c8.27347,0.030762 2.982006,-28.148991 9.899754,-28.336687c6.967995,-0.187704 2.246651,29.947527 9.204983,29.43981c7.632813,-0.560024 0.507309,-32.935357 8.136253,-33.623082c7.698521,-0.689259 2.919197,32.039941 10.628349,32.224557c6.546684,0.160011 3.026451,-27.642808 9.56057,-26.921232c7.192177,0.79388 0.664818,29.842905 7.781624,31.667604c4.748405,1.215439 4.420822,-18.257757 9.204018,-17.440804c11.128883,7.577278 8.628105,37.698658 -2.179977,44.645138c-3.138542,0.698479 -3.965698,-10.502029 -7.112938,-9.905075c-5.59005,1.058502 -3.982124,22.284088 -9.603096,21.799461c-5.239281,-0.456947 -2.226364,-21.636383 -7.47047,-21.730232c-6.961235,-0.116928 -3.357895,28.924408 -10.316231,28.495148c-6.140846,-0.375397 -1.73064,-24.950363 -7.825104,-26.191963c-5.681847,-1.156982 -5.378429,22.170242 -11.027426,20.680939c-6.249069,-1.644684 -0.469624,-26.673519 -6.759275,-27.865887c-3.728954,-0.706188 -2.647665,14.400654 -6.403677,14.545292c-14.016198,-5.938736 -15.748776,-39.707981 -3.899994,-47.666811z'
	}
      ];
      return attributes;
  }

  return {
    getAttributes:getAttributes
  };
}();
