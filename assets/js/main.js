/*jQuery(document).ready(function($) {


           
    
});
*/
$(function() {
	 //======= Skillset *=======
		    
		    
	$('.level-bar-inner').css('width', '0');

	
    $('#mydiv').waypoint(function() {
    	$('.level-bar-inner').each(function() {
            
        	var itemWidth = $(this).data('level');
        
        	$(this).animate({
           		width: itemWidth
        	}, 800);
        });//window.location.href = 'http://google.com';

    	}, {
        offset: '70%'
     });
    
    $('#top-div').waypoint(function() {
    		$('.level-bar-inner').css('width', '0');
    	}, {
        offset: '0%'
     });
 });