from arres import prueba


def test_cookie_firmada():
    valor = prueba.firmar("rest-123")
    assert prueba.verificar(valor) == "rest-123"
    assert prueba.verificar("rest-999." + valor.split(".")[1]) == ""  # no se puede cambiar el id
    assert prueba.verificar("basura") == ""
