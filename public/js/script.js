
$.domReady(function (){

  var width = $('#main').offset().width;
  $('#player').css({ marginLeft: ( ( width - 800) / 2 ) + "px"});

  $('#lights').bind('click', function(e){
    e.preventDefault();
    var body = $('body');

    return body.hasClass('active') ?
      body.removeClass('active'):
      body.addClass('active');
  });

});


